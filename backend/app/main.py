"""FastAPI application factory.

Wires together config, CORS, structured logging, the versioned router, and the
error-envelope handlers. `app` at the bottom is what uvicorn/Docker run.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import RequestContextMiddleware, configure_logging


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()

    app = FastAPI(
        title="Tamalife API",
        version="0.1.0",
        description="Backend for Tamalife. This slice: Clerk-verified auth.",
    )

    # CORS is only relevant to browser clients (Expo web, local tooling).
    # Native mobile requests are not subject to CORS.
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["root"])
    async def root() -> dict[str, str]:
        return {"service": "tamalife-api", "version": "0.1.0"}

    return app


app = create_app()
