from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import structlog
from celery import Task
from sqlalchemy import Select, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.config import Settings, get_settings
from tamalife_backend.db.models import PricingSource, SourceStatus
from tamalife_backend.db.session import create_engine, create_session_factory
from tamalife_backend.tasks.celery_app import celery_app

logger = structlog.get_logger()
settings = get_settings()


@dataclass(frozen=True)
class SourceLease:
    source_id: UUID
    lease_token: str


def _task_request_id(task: Task) -> str:
    headers = getattr(task.request, "headers", None) or {}
    value = headers.get("request_id") if isinstance(headers, dict) else None
    return str(value)[:100] if value else str(uuid4())


def _claim_query(
    session: AsyncSession, config: Settings, now: datetime
) -> Select[tuple[PricingSource]]:
    query = (
        select(PricingSource)
        .where(
            PricingSource.status.in_((SourceStatus.active, SourceStatus.failing)),
            PricingSource.next_check_at <= now,
            or_(
                PricingSource.lease_token.is_(None),
                PricingSource.lease_expires_at.is_(None),
                PricingSource.lease_expires_at <= now,
            ),
        )
        .order_by(PricingSource.next_check_at, PricingSource.id)
        .limit(config.scraper_source_batch_size)
    )
    bind = session.get_bind()
    if bind.dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)
    return query


async def _claim_due_in_session(
    session: AsyncSession,
    config: Settings,
    now: datetime,
) -> list[SourceLease]:
    sources = list((await session.execute(_claim_query(session, config, now))).scalars().all())
    expires_at = now + timedelta(seconds=config.scraper_source_lease_seconds)
    leases: list[SourceLease] = []
    for source in sources:
        token = str(uuid4())
        source.lease_token = token
        source.lease_expires_at = expires_at
        leases.append(SourceLease(source_id=source.id, lease_token=token))
    await session.flush()
    return leases


async def _claim_due_sources(config: Settings, now: datetime | None = None) -> list[SourceLease]:
    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            try:
                leases = await _claim_due_in_session(session, config, now or datetime.now(UTC))
                await session.commit()
                return leases
            except Exception:
                await session.rollback()
                raise
    finally:
        await engine.dispose()


async def _claim_source_for_retry(config: Settings, source_id: UUID) -> SourceLease | None:
    engine = create_engine(config)
    factory = create_session_factory(engine)
    now = datetime.now(UTC)
    try:
        async with factory() as session:
            query = select(PricingSource).where(
                PricingSource.id == source_id,
                PricingSource.status.in_((SourceStatus.active, SourceStatus.failing)),
                or_(
                    PricingSource.lease_token.is_(None),
                    PricingSource.lease_expires_at.is_(None),
                    PricingSource.lease_expires_at <= now,
                ),
            )
            if session.get_bind().dialect.name == "postgresql":
                query = query.with_for_update(skip_locked=True)
            source = (await session.execute(query)).scalar_one_or_none()
            if source is None:
                return None
            lease = SourceLease(source_id=source.id, lease_token=str(uuid4()))
            source.lease_token = lease.lease_token
            source.lease_expires_at = now + timedelta(seconds=config.scraper_source_lease_seconds)
            await session.commit()
            return lease
    finally:
        await engine.dispose()


async def _release_lease(config: Settings, lease: SourceLease) -> None:
    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            await session.execute(
                update(PricingSource)
                .where(
                    PricingSource.id == lease.source_id,
                    PricingSource.lease_token == lease.lease_token,
                )
                .values(lease_token=None, lease_expires_at=None)
            )
            await session.commit()
    finally:
        await engine.dispose()


async def _release_leases(config: Settings, leases: list[SourceLease]) -> None:
    for lease in leases:
        await _release_lease(config, lease)


async def _dispatch_due_sources(config: Settings, request_id: str) -> int:
    leases = await _claim_due_sources(config)
    for index, lease in enumerate(leases):
        try:
            monitor_pricing_source_task.apply_async(
                args=[str(lease.source_id), lease.lease_token],
                headers={"request_id": request_id},
            )
        except Exception:
            await _release_leases(config, leases[index:])
            raise
    return len(leases)


def _outcome_payload(source_id: UUID, outcome: object) -> dict[str, Any]:
    status = getattr(outcome, "status", "completed")
    status = getattr(status, "value", status)
    return {"source_id": str(source_id), "status": str(status)}


async def _monitor_source(
    config: Settings,
    lease: SourceLease,
    request_id: str,
) -> dict[str, Any]:
    from tamalife_backend.services.source_monitoring import monitor_pricing_source

    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            try:
                owns_lease = (
                    await session.execute(
                        select(PricingSource.id).where(
                            PricingSource.id == lease.source_id,
                            PricingSource.lease_token == lease.lease_token,
                        )
                    )
                ).scalar_one_or_none()
                if owns_lease is None:
                    return {"source_id": str(lease.source_id), "status": "stale_lease"}
                outcome = await monitor_pricing_source(
                    session,
                    config,
                    lease.source_id,
                    lease_token=lease.lease_token,
                    request_id=request_id,
                )
                await session.execute(
                    update(PricingSource)
                    .where(
                        PricingSource.id == lease.source_id,
                        PricingSource.lease_token == lease.lease_token,
                    )
                    .values(lease_token=None, lease_expires_at=None)
                )
                await session.commit()
                return _outcome_payload(lease.source_id, outcome)
            except Exception:
                await session.rollback()
                raise
    finally:
        await engine.dispose()


@celery_app.task(bind=True, name="tamalife.schedule_source_monitoring", max_retries=2)  # type: ignore[untyped-decorator]
def schedule_source_monitoring(self: Task) -> int:
    if not settings.scraper_monitoring_enabled:
        return 0
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id, task="schedule_source_monitoring")
    try:
        return asyncio.run(_dispatch_due_sources(settings, request_id))
    except Exception as exc:
        logger.exception("source_monitoring_schedule_failed")
        countdown = min(120, 30 * (2 ** int(getattr(self.request, "retries", 0))))
        raise self.retry(exc=exc, countdown=countdown, max_retries=2) from exc


@celery_app.task(bind=True, name="tamalife.monitor_pricing_source", max_retries=2)  # type: ignore[untyped-decorator]
def monitor_pricing_source_task(
    self: Task,
    source_id: str,
    lease_token: str | None = None,
) -> dict[str, Any]:
    if not settings.scraper_monitoring_enabled:
        return {"status": "disabled"}
    try:
        parsed_source_id = UUID(source_id)
    except ValueError:
        logger.warning("source_monitoring_invalid_source_id", source_id=source_id)
        return {"status": "invalid_source_id"}
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        task="monitor_pricing_source",
        source_id=source_id,
    )
    lease = (
        SourceLease(source_id=parsed_source_id, lease_token=lease_token)
        if lease_token
        else asyncio.run(_claim_source_for_retry(settings, parsed_source_id))
    )
    if lease is None:
        return {"source_id": source_id, "status": "not_claimed"}
    try:
        return asyncio.run(_monitor_source(settings, lease, request_id))
    except Exception as exc:
        asyncio.run(_release_lease(settings, lease))
        logger.exception("pricing_source_monitoring_failed", source_id=source_id)
        countdown = min(120, 30 * (2 ** int(getattr(self.request, "retries", 0))))
        raise self.retry(
            exc=exc,
            countdown=countdown,
            max_retries=2,
            args=[source_id],
        ) from exc
