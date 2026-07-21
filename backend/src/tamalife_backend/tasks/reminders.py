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
    NotificationCategory,
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
    SUBSCRIPTION_CATEGORIES,
    PermanentDeliveryError,
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


def _channels(pref: NotificationPreference | None) -> list[NotificationChannel]:
    """Master channel switches (default: push on, email off)."""
    channels: list[NotificationChannel] = []
    if pref is None or pref.push_enabled:
        channels.append(NotificationChannel.push)
    if pref is not None and pref.email_enabled:
        channels.append(NotificationChannel.email)
    return channels


def _category_enabled(pref: NotificationPreference | None, category: NotificationCategory) -> bool:
    if pref is None:
        return True
    return bool(getattr(pref, f"{category.value}_enabled", True))


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
                        )
                    )
                )
                .scalars()
                .all()
            )
            user_ids = {item.user_id for item in subscriptions}
            preferences: dict[UUID, NotificationPreference] = {}
            users: dict[UUID, User] = {}
            if user_ids:
                preferences = {
                    item.user_id: item
                    for item in (
                        await session.execute(
                            select(NotificationPreference).where(
                                NotificationPreference.user_id.in_(user_ids)
                            )
                        )
                    )
                    .scalars()
                    .all()
                }
                users = {
                    item.id: item
                    for item in (await session.execute(select(User).where(User.id.in_(user_ids))))
                    .scalars()
                    .all()
                }

            candidates: list[ReminderDelivery] = []

            def add(
                user_id: UUID,
                category: NotificationCategory,
                dedupe_suffix: str,
                *,
                subscription_id: UUID | None = None,
                scheduled_for: date | None = None,
                threshold_days: int = 0,
            ) -> None:
                pref = preferences.get(user_id)
                if not _category_enabled(pref, category):
                    return
                for channel in _channels(pref):
                    candidates.append(
                        ReminderDelivery(
                            user_id=user_id,
                            subscription_id=subscription_id,
                            category=category,
                            dedupe_key=f"{category.value}:{channel.value}:{dedupe_suffix}",
                            channel=channel,
                            scheduled_for=scheduled_for or today,
                            threshold_days=threshold_days,
                            status=ReminderDeliveryStatus.pending,
                            attempt_count=0,
                            max_attempts=settings.reminder_max_attempts,
                            next_attempt_at=now,
                            request_id=request_id,
                        )
                    )

            # Subscription-scoped categories.
            for sub in subscriptions:
                pref = preferences.get(sub.user_id)
                target = sub.renewal_or_expiry_date
                days_remaining = (target - today).days if target is not None else None
                if target is not None:
                    thresholds = pref.reminder_days_before if pref else [14, 7, 1]
                    threshold = _eligible_threshold(target, thresholds, today)
                    if threshold is not None:
                        scheduled = target - timedelta(days=threshold)
                        add(
                            sub.user_id,
                            NotificationCategory.renewal,
                            f"{sub.id}:{threshold}:{scheduled}",
                            subscription_id=sub.id,
                            scheduled_for=scheduled,
                            threshold_days=threshold,
                        )
                if sub.previous_amount is not None and sub.amount > sub.previous_amount:
                    add(
                        sub.user_id,
                        NotificationCategory.price_hike,
                        f"{sub.id}:{sub.amount}",
                        subscription_id=sub.id,
                    )
                if days_remaining is not None and 0 <= days_remaining <= 3:
                    add(
                        sub.user_id,
                        NotificationCategory.creature_health,
                        f"{sub.id}:{today}",
                        subscription_id=sub.id,
                    )

            # User-scoped categories (one per user with active subscriptions).
            for user_id in user_ids:
                pref = preferences.get(user_id)
                user = users.get(user_id)
                after = pref.re_engagement_after_days if pref else 7
                last = user.last_active_at if user else None
                if last is not None and (now - _as_utc(last)).days >= after:
                    add(
                        user_id,
                        NotificationCategory.re_engagement,
                        f"{user_id}:{_as_utc(last).date()}",
                    )
                weekday = pref.weekly_digest_weekday if pref else 0
                hour = pref.weekly_digest_hour if pref else 9
                if today.weekday() == weekday and now.hour >= hour:
                    iso = today.isocalendar()
                    add(
                        user_id,
                        NotificationCategory.weekly_digest,
                        f"{user_id}:{iso.year}-W{iso.week}",
                    )

            for delivery in candidates:
                try:
                    async with session.begin_nested():
                        session.add(delivery)
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

            user = await session.get(User, delivery.user_id)
            if user is None or user.disabled_at is not None or user.deleted_at is not None:
                delivery.status = ReminderDeliveryStatus.canceled
                delivery.last_error = "Reminder owner no longer exists or is disabled"
                await session.commit()
                return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)

            # Subscription-scoped categories must still point at an eligible item;
            # user-scoped ones (re-engagement, digest) carry no subscription.
            subscription: Subscription | None = None
            if delivery.category in SUBSCRIPTION_CATEGORIES:
                subscription = await session.get(Subscription, delivery.subscription_id)
                inactive = (
                    subscription is None
                    or subscription.archived_at is not None
                    or subscription.status != SubscriptionStatus.active
                    or (
                        delivery.category
                        in {NotificationCategory.renewal, NotificationCategory.creature_health}
                        and subscription.renewal_or_expiry_date is None
                    )
                )
                if inactive:
                    delivery.status = ReminderDeliveryStatus.canceled
                    delivery.last_error = "Subscription is no longer eligible"
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
            payload = await build_reminder_payload(session, delivery, subscription, user)
            attempt = delivery.attempt_count
            max_attempts = delivery.max_attempts
            await session.commit()

        try:
            provider_message_id = await sender.send(
                payload,
                idempotency_key=f"reminder:{delivery_id}",
                request_id=request_id,
            )
        except PermanentDeliveryError as exc:
            async with factory() as session:
                delivery = await session.get(ReminderDelivery, delivery_id, with_for_update=True)
                if delivery is None:
                    return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)
                delivery.status = ReminderDeliveryStatus.canceled
                delivery.last_error = f"{type(exc).__name__}: {exc}"[:2000]
                await session.commit()
                return DeliveryAttemptResult(ReminderDeliveryStatus.canceled)
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
            # Only subscription-scoped notifications leave a subscription event;
            # user-scoped ones (re-engagement, digest) have no subscription to log against.
            if delivery.subscription_id is not None:
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
                                "category": delivery.category.value,
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
