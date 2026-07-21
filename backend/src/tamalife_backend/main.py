from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.engine import make_url
from starlette.middleware.trustedhost import TrustedHostMiddleware

from tamalife_backend.api.router import api_router
from tamalife_backend.config import Settings, get_settings
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.errors import ApiError, api_error_handler, validation_error_handler
from tamalife_backend.logging import configure_logging
from tamalife_backend.schemas import HealthResponse, ReadinessResponse
from tamalife_backend.security import SecurityMiddleware
from tamalife_backend.services.extraction import create_extractor
from tamalife_backend.services.metrics import Metrics
from tamalife_backend.services.redis import Cache, ParseRateLimiter
from tamalife_backend.services.storage import create_storage

logger = structlog.get_logger()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    settings.validate_runtime()
    configure_logging(settings.log_level)
    if settings.database_url.startswith("sqlite"):
        database_path = make_url(settings.database_url).database
        if database_path and database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            send_default_pii=False,
        )

    engine = create_engine(settings)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if settings.auto_create_schema:
            await create_schema(engine)
        app.state.settings = settings
        app.state.engine = engine
        app.state.session_factory = session_factory
        app.state.storage = create_storage(settings)
        app.state.extractor = create_extractor(settings)
        app.state.cache = Cache(settings)
        app.state.parse_limiter = ParseRateLimiter(settings)
        app.state.metrics = Metrics()
        logger.info("application_started", environment=settings.environment)
        yield
        await app.state.parse_limiter.close()
        await app.state.cache.close()
        await engine.dispose()
        logger.info("application_stopped")

    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.metrics = Metrics()
    # In local development a physical device reaches the API over the machine's
    # LAN IP, so its Host/Origin won't match the localhost allowlist. Relax both
    # checks for `local` only; production still requires explicit values (see
    # Settings.validate_runtime).
    local_dev = settings.environment == "local"
    cors_origins = ["*"] if local_dev else settings.cors_origins
    trusted_hosts = ["*"] if local_dev else settings.trusted_hosts
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-Request-ID",
            "X-User-ID",
        ],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)
    app.add_middleware(
        SecurityMiddleware,
        max_body_bytes=settings.max_request_body_bytes,
        hsts=settings.environment == "production",
    )
    app.add_exception_handler(ApiError, api_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]

    @app.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = request.headers.get("X-Request-ID", str(uuid4()))[:100]
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.get("/health", response_model=HealthResponse, tags=["system"])
    async def health() -> HealthResponse:
        return HealthResponse(version=settings.api_version)

    @app.get("/ready", response_model=ReadinessResponse, tags=["system"])
    async def ready() -> ReadinessResponse:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        await app.state.storage.healthcheck()
        cache_ok = await app.state.cache.ping()
        if settings.cache_enabled and not cache_ok:
            raise ApiError("cache_unavailable", "Redis is not ready", 503)
        cache_status = "ok" if cache_ok else "disabled"
        return ReadinessResponse(cache=cache_status)

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
