from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    ItemType,
    NotificationCategory,
    NotificationPreference,
    ReminderDelivery,
    ReminderDeliveryStatus,
    Subscription,
    SubscriptionEvent,
    User,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.reminders import PermanentDeliveryError, ReminderPayload
from tamalife_backend.tasks.reminders import _deliver, _scan

pytestmark = pytest.mark.asyncio

NOW = datetime(2026, 7, 18, 12, tzinfo=UTC)


class SuccessfulSender:
    def __init__(self) -> None:
        self.calls: list[tuple[ReminderPayload, str, str]] = []

    async def send(self, payload: ReminderPayload, *, idempotency_key: str, request_id: str) -> str:
        self.calls.append((payload, idempotency_key, request_id))
        return "provider-123"


class FailingSender:
    async def send(
        self, payload: ReminderPayload, *, idempotency_key: str, request_id: str
    ) -> None:
        del payload, idempotency_key, request_id
        raise RuntimeError("provider unavailable")


class UnsupportedChannelSender:
    async def send(
        self, payload: ReminderPayload, *, idempotency_key: str, request_id: str
    ) -> None:
        del payload, idempotency_key, request_id
        raise PermanentDeliveryError("provider cannot deliver this channel")


def reminder_settings(tmp_path: Path, *, max_attempts: int = 3) -> Settings:
    return Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'reminders.db').as_posix()}",
        auto_create_schema=False,
        clerk_auth_enabled=False,
        reminder_delivery_enabled=True,
        reminder_max_attempts=max_attempts,
        reminder_retry_base_seconds=10,
        reminder_retry_max_seconds=60,
    )


async def seed_subscription(settings: Settings, *, email_enabled: bool = True) -> None:
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    async with factory() as session:
        user = User(email="person@example.com")
        session.add(user)
        await session.flush()
        session.add(
            Subscription(
                user_id=user.id,
                vendor_name="StreamFlix",
                display_name="Streaming",
                item_type=ItemType.subscription,
                amount=Decimal("19.99"),
                billing_cycle=BillingCycle.monthly,
                renewal_or_expiry_date=NOW.date() + timedelta(days=5),
            )
        )
        session.add(
            NotificationPreference(
                user_id=user.id,
                reminder_days_before=[14, 7, 1],
                push_enabled=True,
                email_enabled=email_enabled,
            )
        )
        await session.commit()
    await engine.dispose()


async def load_deliveries(settings: Settings) -> list[ReminderDelivery]:
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        values = list(
            (await session.execute(select(ReminderDelivery).order_by(ReminderDelivery.channel)))
            .scalars()
            .all()
        )
    await engine.dispose()
    return values


async def test_scan_persists_channel_deliveries_and_is_idempotent(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path)
    await seed_subscription(settings)

    first = await _scan(settings=settings, now=NOW, request_id="scan-1")
    second = await _scan(settings=settings, now=NOW, request_id="scan-2")
    await _scan(settings=settings, now=NOW + timedelta(days=1), request_id="scan-next-day")
    deliveries = await load_deliveries(settings)

    assert len(first) == 2
    assert second == []
    assert len(deliveries) == 2
    assert {item.channel.value for item in deliveries} == {"push", "email"}
    assert {item.threshold_days for item in deliveries} == {7}
    assert {item.scheduled_for for item in deliveries} == {NOW.date() - timedelta(days=2)}
    assert {item.max_attempts for item in deliveries} == {3}


async def test_delivery_is_recorded_once_with_correlation_id(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path)
    await seed_subscription(settings, email_enabled=False)
    delivery_id = (await _scan(settings=settings, now=NOW, request_id="scan"))[0]
    sender = SuccessfulSender()

    result = await _deliver(
        delivery_id,
        settings=settings,
        sender=sender,
        now=NOW,
        request_id="request-123",
    )
    duplicate = await _deliver(
        delivery_id,
        settings=settings,
        sender=sender,
        now=NOW,
        request_id="request-duplicate",
    )

    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        delivery = await session.get(ReminderDelivery, delivery_id)
        event_count = await session.scalar(select(func.count()).select_from(SubscriptionEvent))
    await engine.dispose()

    assert result.status == ReminderDeliveryStatus.delivered
    assert duplicate.status == ReminderDeliveryStatus.delivered
    assert len(sender.calls) == 1
    assert sender.calls[0][1:] == (f"reminder:{delivery_id}", "request-123")
    assert delivery is not None
    assert delivery.attempt_count == 1
    assert delivery.provider_message_id == "provider-123"
    assert delivery.request_id == "request-123"
    assert event_count == 1


async def test_delivery_retries_then_moves_to_dead_letter(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path, max_attempts=2)
    await seed_subscription(settings, email_enabled=False)
    delivery_id = (await _scan(settings=settings, now=NOW, request_id="scan"))[0]
    sender = FailingSender()

    first = await _deliver(delivery_id, settings=settings, sender=sender, now=NOW)
    second = await _deliver(
        delivery_id,
        settings=settings,
        sender=sender,
        now=NOW + timedelta(minutes=10),
    )
    delivery = (await load_deliveries(settings))[0]

    assert first.status == ReminderDeliveryStatus.retrying
    assert first.retry_in_seconds is not None
    assert 1 <= first.retry_in_seconds <= settings.reminder_retry_max_seconds
    assert second.status == ReminderDeliveryStatus.dead_letter
    assert second.retry_in_seconds is None
    assert delivery.attempt_count == 2
    assert "provider unavailable" in (delivery.last_error or "")


async def test_scan_recovers_an_expired_processing_lease(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path)
    await seed_subscription(settings, email_enabled=False)
    delivery_id = (await _scan(settings=settings, now=NOW, request_id="scan"))[0]
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        delivery = await session.get(ReminderDelivery, delivery_id)
        assert delivery is not None
        delivery.status = ReminderDeliveryStatus.processing
        delivery.last_attempt_at = NOW - timedelta(
            seconds=settings.reminder_processing_timeout_seconds + 1
        )
        await session.commit()
    await engine.dispose()

    due = await _scan(settings=settings, now=NOW, request_id="recovery")
    delivery = (await load_deliveries(settings))[0]

    assert due == [delivery_id]
    assert delivery.status == ReminderDeliveryStatus.pending
    assert delivery.request_id == "recovery"
    assert "lease expired" in (delivery.last_error or "")


async def test_weekly_digest_waits_for_configured_hour(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path)
    await seed_subscription(settings, email_enabled=False)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        preference = await session.scalar(select(NotificationPreference))
        assert preference is not None
        preference.weekly_digest_weekday = NOW.weekday()
        preference.weekly_digest_hour = NOW.hour + 1
        await session.commit()
    await engine.dispose()

    await _scan(settings=settings, now=NOW, request_id="before-digest-hour")
    before = await load_deliveries(settings)
    await _scan(settings=settings, now=NOW + timedelta(hours=1), request_id="digest-hour")
    after = await load_deliveries(settings)

    assert all(item.category != NotificationCategory.weekly_digest for item in before)
    assert sum(item.category == NotificationCategory.weekly_digest for item in after) == 1


async def test_scan_does_not_create_health_reminders_for_expired_items(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path)
    await seed_subscription(settings, email_enabled=False)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        subscription = await session.scalar(select(Subscription))
        assert subscription is not None
        subscription.renewal_or_expiry_date = NOW.date() - timedelta(days=1)
        await session.commit()
    await engine.dispose()

    assert await _scan(settings=settings, now=NOW, request_id="expired") == []
    assert await load_deliveries(settings) == []


async def test_price_hike_delivery_does_not_require_a_renewal_date(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path)
    await seed_subscription(settings, email_enabled=False)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        subscription = await session.scalar(select(Subscription))
        assert subscription is not None
        subscription.renewal_or_expiry_date = None
        subscription.previous_amount = Decimal("9.99")
        await session.commit()
    await engine.dispose()

    delivery_id = (await _scan(settings=settings, now=NOW, request_id="price-hike"))[0]
    sender = SuccessfulSender()
    result = await _deliver(delivery_id, settings=settings, sender=sender, now=NOW)

    assert result.status == ReminderDeliveryStatus.delivered
    assert sender.calls[0][0].category == NotificationCategory.price_hike


async def test_permanent_provider_mismatch_is_canceled_without_retry(tmp_path: Path) -> None:
    settings = reminder_settings(tmp_path)
    await seed_subscription(settings, email_enabled=False)
    delivery_id = (await _scan(settings=settings, now=NOW, request_id="scan"))[0]

    result = await _deliver(
        delivery_id,
        settings=settings,
        sender=UnsupportedChannelSender(),
        now=NOW,
    )
    delivery = (await load_deliveries(settings))[0]

    assert result.status == ReminderDeliveryStatus.canceled
    assert result.retry_in_seconds is None
    assert delivery.attempt_count == 1
    assert "cannot deliver this channel" in (delivery.last_error or "")
