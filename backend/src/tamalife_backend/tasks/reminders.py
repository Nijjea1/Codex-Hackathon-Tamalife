from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

import structlog
from celery import Task
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError

from tamalife_backend.config import Settings, get_settings
from tamalife_backend.db.models import (
    EventType,
    NotificationChannel,
    NotificationPreference,
    ReminderDelivery,
    ReminderDeliveryStatus,
    Subscription,
    SubscriptionEvent,
    SubscriptionStatus,
    User,
)
from tamalife_backend.db.session import create_engine, create_session_factory
from tamalife_backend.services.reminders import (
    ReminderSender,
    build_reminder_payload,
    create_reminder_sender,
)
from tamalife_backend.tasks.celery_app import celery_app

logger = structlog.get_logger()


@dataclass(frozen=True)
class DeliveryAttemptResult:
    status: ReminderDeliveryStatus
    retry_in_seconds: int | None = None


def _task_request_id(task: Task) -> str:
    headers = getattr(task.request, "headers", None) or {}
    value = headers.get("request_id") if isinstance(headers, dict) else None
    return str(value)[:100] if value else str(uuid4())


def _eligible_threshold(target_date: date, thresholds: list[int], today: date) -> int | None:
    days_remaining = (target_date - today).days
    if days_remaining < 0:
        return None
    eligible = sorted({value for value in thresholds if value >= days_remaining})
    return eligible[0] if eligible else None


def _retry_delay(settings: Settings, attempt: int, delivery_id: UUID) -> int:
    base = min(
        settings.reminder_retry_base_seconds * (2 ** max(attempt - 1, 0)),
        settings.reminder_retry_max_seconds,
    )
    digest = hashlib.sha256(f"{delivery_id}:{attempt}".encode()).digest()
    jitter_percent = 80 + int(digest[0]) % 41
    return int(max(1, min(base * jitter_percent // 100, settings.reminder_retry_max_seconds)))


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


async def _scan(
    *,
    settings: Settings | None = None,
    now: datetime | None = None,
    request_id: str | None = None,
) -> list[UUID]:
    settings = settings or get_settings()
    if not settings.reminder_delivery_enabled:
        return []
    now = now or datetime.now(UTC)
    request_id = (request_id or str(uuid4()))[:100]
    today = now.date()
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            subscriptions = list(
                (
                    await session.execute(
                        select(Subscription).where(
                            Subscription.archived_at.is_(None),
                            Subscription.status == SubscriptionStatus.active,
                            Subscription.renewal_or_expiry_date.is_not(None),
                        )
                    )
                )
                .scalars()
                .all()
            )
            user_ids = {item.user_id for item in subscriptions}
            preferences: dict[UUID, NotificationPreference] = {}
            if user_ids:
                preferences = {
                    item.user_id: item
                    for item in (
                        (
                            await session.execute(
                                select(NotificationPreference).where(
                                    NotificationPreference.user_id.in_(user_ids)
                                )
                            )
                        )
                        .scalars()
                        .all()
                    )
                }

            for subscription in subscriptions:
                target_date = subscription.renewal_or_expiry_date
                if target_date is None:
                    continue
                preference = preferences.get(subscription.user_id)
                thresholds = preference.reminder_days_before if preference else [14, 7, 1]
                threshold = _eligible_threshold(target_date, thresholds, today)
                if threshold is None:
                    continue
                channels: list[NotificationChannel] = []
                if preference is None or preference.push_enabled:
                    channels.append(NotificationChannel.push)
                if preference is not None and preference.email_enabled:
                    channels.append(NotificationChannel.email)
                for channel in channels:
                    try:
                        async with session.begin_nested():
                            session.add(
                                ReminderDelivery(
                                    user_id=subscription.user_id,
                                    subscription_id=subscription.id,
                                    channel=channel,
                                    scheduled_for=target_date - timedelta(days=threshold),
                                    threshold_days=threshold,
                                    status=ReminderDeliveryStatus.pending,
                                    attempt_count=0,
                                    max_attempts=settings.reminder_max_attempts,
                                    next_attempt_at=now,
                                    request_id=request_id,
                                )
                            )
                            await session.flush()
                    except IntegrityError:
                        # Another beat instance or an earlier scan already created it.
                        pass

            stale_before = now - timedelta(seconds=settings.reminder_processing_timeout_seconds)
            due = list(
                (
                    await session.execute(
                        select(ReminderDelivery)
                        .where(
                            or_(
                                and_(
                                    ReminderDelivery.status.in_(
                                        [
                                            ReminderDeliveryStatus.pending,
                                            ReminderDeliveryStatus.retrying,
                                        ]
                                    ),
                                    ReminderDelivery.next_attempt_at <= now,
                                ),
                                and_(
                                    ReminderDelivery.status == ReminderDeliveryStatus.processing,
                                    ReminderDelivery.last_attempt_at <= stale_before,
                                ),
                            )
                        )
                        .with_for_update(skip_locked=True)
                    )
                )
                .scalars()
                .all()
            )
            for delivery in due:
                if delivery.status == ReminderDeliveryStatus.processing:
                    delivery.last_error = "Recovered after the processing lease expired"
                delivery.status = ReminderDeliveryStatus.pending
                delivery.next_attempt_at = now + timedelta(
                    seconds=settings.reminder_processing_timeout_seconds
                )
                delivery.request_id = request_id
            await session.commit()
            return [delivery.id for delivery in due]
    finally:
        await engine.dispose()


async def _deliver(
    delivery_id: UUID,
    *,
    settings: Settings | None = None,
    sender: ReminderSender | None = None,
    now: datetime | None = None,
    request_id: str | None = None,
) -> DeliveryAttemptResult:
    settings = settings or get_settings()
    sender = sender or create_reminder_sender(settings)
    now = now or datetime.now(UTC)
    request_id = (request_id or str(uuid4()))[:100]
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            delivery = await session.get(ReminderDelivery, delivery_id, with_for_update=True)
            if delivery is None:
                return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)
            if delivery.status in {
                ReminderDeliveryStatus.delivered,
                ReminderDeliveryStatus.canceled,
                ReminderDeliveryStatus.dead_letter,
            }:
                return DeliveryAttemptResult(delivery.status)
            if (
                delivery.status == ReminderDeliveryStatus.processing
                and delivery.last_attempt_at is not None
            ):
                lease_expires = _as_utc(delivery.last_attempt_at) + timedelta(
                    seconds=settings.reminder_processing_timeout_seconds
                )
                if lease_expires > now:
                    seconds = max(1, int((lease_expires - now).total_seconds()))
                    return DeliveryAttemptResult(ReminderDeliveryStatus.processing, seconds)
            next_attempt_at = _as_utc(delivery.next_attempt_at)
            if delivery.status != ReminderDeliveryStatus.pending and next_attempt_at > now:
                seconds = max(1, int((next_attempt_at - now).total_seconds()))
                return DeliveryAttemptResult(delivery.status, seconds)

            subscription = await session.get(Subscription, delivery.subscription_id)
            user = await session.get(User, delivery.user_id)
            if subscription is None or user is None:
                delivery.status = ReminderDeliveryStatus.canceled
                delivery.last_error = "Reminder owner or subscription no longer exists"
                await session.commit()
                return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)
            inactive = (
                subscription.archived_at is not None
                or subscription.status != SubscriptionStatus.active
                or user.disabled_at is not None
                or user.deleted_at is not None
                or subscription.renewal_or_expiry_date is None
            )
            if inactive:
                delivery.status = ReminderDeliveryStatus.canceled
                delivery.last_error = "Reminder owner or subscription is no longer eligible"
                await session.commit()
                return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)
            if delivery.channel == NotificationChannel.email and not user.email:
                delivery.status = ReminderDeliveryStatus.canceled
                delivery.last_error = "Email delivery has no destination"
                await session.commit()
                return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)

            delivery.status = ReminderDeliveryStatus.processing
            delivery.attempt_count += 1
            delivery.last_attempt_at = now
            delivery.request_id = request_id
            payload = build_reminder_payload(delivery, subscription, user)
            attempt = delivery.attempt_count
            max_attempts = delivery.max_attempts
            await session.commit()

        try:
            provider_message_id = await sender.send(
                payload,
                idempotency_key=f"reminder:{delivery_id}",
                request_id=request_id,
            )
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"[:2000]
            async with factory() as session:
                delivery = await session.get(ReminderDelivery, delivery_id, with_for_update=True)
                if delivery is None:
                    return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)
                delivery.last_error = error
                if attempt >= max_attempts:
                    delivery.status = ReminderDeliveryStatus.dead_letter
                    retry_in = None
                else:
                    retry_in = _retry_delay(settings, attempt, delivery_id)
                    delivery.status = ReminderDeliveryStatus.retrying
                    delivery.next_attempt_at = now + timedelta(seconds=retry_in)
                await session.commit()
                return DeliveryAttemptResult(delivery.status, retry_in)

        async with factory() as session:
            delivery = await session.get(ReminderDelivery, delivery_id, with_for_update=True)
            if delivery is None:
                return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)
            if delivery.status == ReminderDeliveryStatus.delivered:
                return DeliveryAttemptResult(ReminderDeliveryStatus.delivered)
            delivery.status = ReminderDeliveryStatus.delivered
            delivery.delivered_at = now
            delivery.provider_message_id = provider_message_id
            delivery.last_error = None
            event_key = f"reminder-delivery:{delivery.id}"
            existing_event = await session.scalar(
                select(SubscriptionEvent).where(
                    SubscriptionEvent.subscription_id == delivery.subscription_id,
                    SubscriptionEvent.idempotency_key == event_key,
                )
            )
            if existing_event is None:
                session.add(
                    SubscriptionEvent(
                        subscription_id=delivery.subscription_id,
                        event_type=EventType.reminder_sent,
                        idempotency_key=event_key,
                        data={
                            "delivery_id": str(delivery.id),
                            "channel": delivery.channel.value,
                            "days_before": delivery.threshold_days,
                            "provider_message_id": provider_message_id,
                            "request_id": request_id,
                        },
                    )
                )
            await session.commit()
            return DeliveryAttemptResult(ReminderDeliveryStatus.delivered)
    finally:
        await engine.dispose()


async def _release_pending(
    delivery_ids: list[UUID], *, settings: Settings | None = None, error: str
) -> None:
    if not delivery_ids:
        return
    settings = settings or get_settings()
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            deliveries = list(
                (
                    await session.execute(
                        select(ReminderDelivery)
                        .where(
                            ReminderDelivery.id.in_(delivery_ids),
                            ReminderDelivery.status == ReminderDeliveryStatus.pending,
                        )
                        .with_for_update(skip_locked=True)
                    )
                )
                .scalars()
                .all()
            )
            now = datetime.now(UTC)
            for delivery in deliveries:
                delivery.status = ReminderDeliveryStatus.retrying
                delivery.next_attempt_at = now
                delivery.last_error = error[:2000]
            await session.commit()
    finally:
        await engine.dispose()


@celery_app.task(bind=True, name="tamalife.scan_reminders", max_retries=None)  # type: ignore[untyped-decorator]
def scan_reminders(self: Task) -> int:
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id, task="scan_reminders")
    delivery_ids = asyncio.run(_scan(request_id=request_id))
    dispatched = 0
    try:
        for delivery_id in delivery_ids:
            deliver_reminder.apply_async(
                args=[str(delivery_id)],
                headers={"request_id": request_id},
            )
            dispatched += 1
    except Exception as exc:
        asyncio.run(
            _release_pending(
                delivery_ids[dispatched:],
                error=f"Broker publish failed: {type(exc).__name__}: {exc}",
            )
        )
        raise self.retry(exc=exc, countdown=30, max_retries=None) from exc
    return len(delivery_ids)


@celery_app.task(bind=True, name="tamalife.deliver_reminder", max_retries=None)  # type: ignore[untyped-decorator]
def deliver_reminder(self: Task, delivery_id: str) -> str:
    request_id = _task_request_id(self)
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        task="deliver_reminder",
        delivery_id=delivery_id,
    )
    result = asyncio.run(_deliver(UUID(delivery_id), request_id=request_id))
    if result.status == ReminderDeliveryStatus.retrying and result.retry_in_seconds:
        raise self.retry(countdown=result.retry_in_seconds, max_retries=None)
    return result.status.value
