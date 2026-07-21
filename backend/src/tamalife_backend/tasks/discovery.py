from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID, uuid4

import structlog
from celery import Task
from sqlalchemy import select

from tamalife_backend.config import Settings, get_settings
from tamalife_backend.db.models import Provider
from tamalife_backend.db.session import create_engine, create_session_factory
from tamalife_backend.tasks.celery_app import celery_app

logger = structlog.get_logger()
settings = get_settings()


def _task_request_id(task: Task) -> str:
    headers = getattr(task.request, "headers", None) or {}
    value = headers.get("request_id") if isinstance(headers, dict) else None
    return str(value)[:100] if value else str(uuid4())


async def _active_provider_ids(config: Settings) -> list[UUID]:
    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            return list(
                (
                    await session.execute(
                        select(Provider.id)
                        .where(Provider.active.is_(True))
                        .order_by(Provider.id)
                        .limit(config.discovery_max_providers_per_run)
                    )
                )
                .scalars()
                .all()
            )
    finally:
        await engine.dispose()


async def _discover_provider(
    provider_id: UUID, *, config: Settings, request_id: str
) -> dict[str, Any]:
    # Local import keeps the Celery app importable while the discovery service is
    # independently testable and prevents task wiring from owning its idempotency.
    from tamalife_backend.services.scraper_discovery import discover_provider_sources

    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            try:
                outcome = await discover_provider_sources(
                    session,
                    config,
                    provider_id,
                    request_id=request_id,
                )
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        status = getattr(outcome.status, "value", outcome.status)
        return {
            "run_id": str(outcome.run_id),
            "status": str(status),
            "candidate_count": outcome.candidate_count,
            "reused": outcome.reused,
        }
    finally:
        await engine.dispose()


async def _dispatch_monthly(config: Settings, request_id: str) -> int:
    provider_ids = await _active_provider_ids(config)
    for provider_id in provider_ids:
        discover_provider_sources_task.apply_async(
            args=[str(provider_id)],
            headers={"request_id": request_id},
        )
    return len(provider_ids)


@celery_app.task(
    bind=True,
    name="tamalife.schedule_source_discovery",
    max_retries=2,
)  # type: ignore[untyped-decorator]
def schedule_source_discovery(self: Task) -> int:
    if not settings.discovery_enabled:
        return 0
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        task="schedule_source_discovery",
    )
    try:
        return asyncio.run(_dispatch_monthly(settings, request_id))
    except Exception as exc:
        logger.exception("source_discovery_schedule_failed")
        countdown = 30 * (2 ** int(getattr(self.request, "retries", 0)))
        raise self.retry(exc=exc, countdown=countdown, max_retries=2) from exc


@celery_app.task(
    bind=True,
    name="tamalife.discover_provider_sources",
    max_retries=2,
)  # type: ignore[untyped-decorator]
def discover_provider_sources_task(self: Task, provider_id: str) -> dict[str, Any]:
    if not settings.discovery_enabled:
        return {"status": "disabled"}
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        task="discover_provider_sources",
        provider_id=provider_id,
    )
    try:
        parsed_provider_id = UUID(provider_id)
    except ValueError:
        logger.warning("source_discovery_invalid_provider_id", provider_id=provider_id)
        return {"status": "invalid_provider_id"}
    try:
        return asyncio.run(
            _discover_provider(parsed_provider_id, config=settings, request_id=request_id)
        )
    except Exception as exc:
        logger.exception("provider_source_discovery_failed", provider_id=provider_id)
        countdown = 30 * (2 ** int(getattr(self.request, "retries", 0)))
        raise self.retry(exc=exc, countdown=countdown, max_retries=2) from exc
