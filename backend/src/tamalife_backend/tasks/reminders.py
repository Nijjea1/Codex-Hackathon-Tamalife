from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from tamalife_backend.config import get_settings
from tamalife_backend.db.models import (
    EventType,
    NotificationPreference,
    Subscription,
    SubscriptionEvent,
    SubscriptionStatus,
)
from tamalife_backend.db.session import create_engine, create_session_factory
from tamalife_backend.domain.health import matching_reminder_threshold
from tamalife_backend.tasks.celery_app import celery_app


async def _scan() -> int:
    settings = get_settings()
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    created = 0
    today = datetime.now(UTC).date()
    async with factory() as session:
        result = await session.execute(
            select(Subscription)
            .options(selectinload(Subscription.events))
            .where(
                Subscription.archived_at.is_(None),
                Subscription.status == SubscriptionStatus.active,
                Subscription.renewal_or_expiry_date.is_not(None),
            )
        )
        for subscription in result.scalars().all():
            preference = await session.scalar(
                select(NotificationPreference).where(
                    NotificationPreference.user_id == subscription.user_id
                )
            )
            days = preference.reminder_days_before if preference else [14, 7, 1]
            target_date = subscription.renewal_or_expiry_date
            if target_date is None:
                continue
            threshold = matching_reminder_threshold(target_date, days, now=today)
            if threshold is None:
                continue
            key = f"reminder:{today.isoformat()}:{threshold}"
            exists = await session.scalar(
                select(SubscriptionEvent).where(
                    SubscriptionEvent.subscription_id == subscription.id,
                    SubscriptionEvent.idempotency_key == key,
                )
            )
            if exists:
                continue
            session.add(
                SubscriptionEvent(
                    subscription_id=subscription.id,
                    event_type=EventType.reminder_sent,
                    idempotency_key=key,
                    data={"days_before": threshold, "delivery": "pending"},
                )
            )
            created += 1
        await session.commit()
    await engine.dispose()
    return created


@celery_app.task(name="tamalife.scan_reminders")  # type: ignore[untyped-decorator]
def scan_reminders() -> int:
    return asyncio.run(_scan())
