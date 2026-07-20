from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID, uuid4

import structlog
from celery import Task
from sqlalchemy import select

from tamalife_backend.config import Settings, get_settings
from tamalife_backend.db.models import Subscription, SubscriptionStatus, User
from tamalife_backend.db.session import create_engine, create_session_factory
from tamalife_backend.tasks.celery_app import celery_app

logger = structlog.get_logger()
settings = get_settings()


def _task_request_id(task: Task) -> str:
    headers = getattr(task.request, "headers", None) or {}
    value = headers.get("request_id") if isinstance(headers, dict) else None
    return str(value)[:100] if value else str(uuid4())


async def _eligible_user_ids(config: Settings) -> list[UUID]:
    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            return list(
                (
                    await session.scalars(
                        select(Subscription.user_id)
                        .join(User, User.id == Subscription.user_id)
                        .where(
                            Subscription.status == SubscriptionStatus.active,
                            Subscription.archived_at.is_(None),
                            User.disabled_at.is_(None),
                            User.deleted_at.is_(None),
                        )
                        .distinct()
                        .order_by(Subscription.user_id)
                        .limit(config.price_intelligence_refresh_batch_size)
                    )
                ).all()
            )
    finally:
        await engine.dispose()


async def _refresh_user(
    user_id: UUID,
    *,
    config: Settings,
    request_id: str,
) -> dict[str, Any]:
    from tamalife_backend.services.recommendations import (
        generate_user_recommendations,
        match_user_subscriptions,
    )

    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            try:
                match_outcome = await match_user_subscriptions(session, user_id)
                recommendation_outcome = await generate_user_recommendations(
                    session,
                    user_id,
                    request_id=request_id,
                )
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        return {
            "user_id": str(user_id),
            "matches_created": match_outcome.created,
            "matches_updated": match_outcome.updated,
            "subscriptions_unmatched": match_outcome.unmatched,
            "recommendations_created": recommendation_outcome.recommendations_created,
            "recommendations_updated": recommendation_outcome.recommendations_updated,
            "alerts_created": recommendation_outcome.alerts_created,
        }
    finally:
        await engine.dispose()


async def _dispatch_refreshes(config: Settings, request_id: str) -> int:
    user_ids = await _eligible_user_ids(config)
    for user_id in user_ids:
        refresh_user_price_intelligence_task.apply_async(
            args=[str(user_id)],
            headers={"request_id": request_id},
        )
    return len(user_ids)


@celery_app.task(
    bind=True,
    name="tamalife.schedule_price_intelligence_refresh",
    max_retries=2,
)  # type: ignore[untyped-decorator]
def schedule_price_intelligence_refresh(self: Task) -> int:
    if not settings.price_intelligence_refresh_enabled:
        return 0
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        task="schedule_price_intelligence_refresh",
    )
    try:
        return asyncio.run(_dispatch_refreshes(settings, request_id))
    except Exception as exc:
        logger.exception("price_intelligence_refresh_schedule_failed")
        countdown = 30 * (2 ** int(getattr(self.request, "retries", 0)))
        raise self.retry(exc=exc, countdown=countdown, max_retries=2) from exc


@celery_app.task(
    bind=True,
    name="tamalife.refresh_user_price_intelligence",
    max_retries=2,
)  # type: ignore[untyped-decorator]
def refresh_user_price_intelligence_task(self: Task, user_id: str) -> dict[str, Any]:
    if not settings.price_intelligence_refresh_enabled:
        return {"status": "disabled"}
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        task="refresh_user_price_intelligence",
        user_id=user_id,
    )
    try:
        parsed_user_id = UUID(user_id)
    except ValueError:
        logger.warning("price_intelligence_refresh_invalid_user_id", user_id=user_id)
        return {"status": "invalid_user_id"}
    try:
        return asyncio.run(_refresh_user(parsed_user_id, config=settings, request_id=request_id))
    except Exception as exc:
        logger.exception("price_intelligence_user_refresh_failed", user_id=user_id)
        countdown = 30 * (2 ** int(getattr(self.request, "retries", 0)))
        raise self.retry(exc=exc, countdown=countdown, max_retries=2) from exc
