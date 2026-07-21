from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from firebase_admin import messaging
from sqlalchemy import select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    DevicePlatform,
    DevicePushToken,
    NotificationCategory,
    NotificationChannel,
    User,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.reminders import (
    FCM_BATCH_SIZE,
    FcmReminderSender,
    FcmSendResult,
    ReminderPayload,
)


def payload(*, user_id=None, channel: NotificationChannel = NotificationChannel.push):
    return ReminderPayload(
        delivery_id=uuid4(),
        user_id=user_id or uuid4(),
        clerk_user_id=None,
        email=None,
        category=NotificationCategory.renewal,
        channel=channel,
        title="Renewal coming up",
        body="StreamFlix renews on 2026-08-01 (7 days away).",
        subscription_id=uuid4(),
        display_name="StreamFlix",
        vendor_name="StreamFlix",
        renewal_or_expiry_date=date(2026, 8, 1).isoformat(),
        days_before=7,
    )


@pytest.mark.filterwarnings("ignore:Message.token is deprecated:DeprecationWarning")
def test_fcm_batches_messages_and_classifies_dead_tokens(monkeypatch) -> None:
    sender = FcmReminderSender(Settings(clerk_auth_enabled=False))
    sender._app = object()
    calls: list[int] = []

    def send_each(messages, *, app):
        assert app is sender._app
        calls.append(len(messages))
        responses = []
        for message in messages:
            assert message.android.notification.channel_id == "reminders"
            assert message.android.notification.icon == "notification_icon"
            assert message.android.notification.color == "#F3A6C0"
            assert message.android.priority == "high"
            assert message.apns.payload.aps.sound == "default"
            if message.token == "dead":
                responses.append(
                    SimpleNamespace(
                        success=False,
                        message_id=None,
                        exception=messaging.UnregisteredError("unregistered"),
                    )
                )
            else:
                responses.append(
                    SimpleNamespace(success=True, message_id=f"id:{message.token}", exception=None)
                )
        return SimpleNamespace(responses=responses)

    monkeypatch.setattr(messaging, "send_each", send_each)
    tokens = [f"device-{index}" for index in range(FCM_BATCH_SIZE)] + ["dead"]

    result = sender._send_sync(tokens, payload())

    assert calls == [FCM_BATCH_SIZE, 1]
    assert result.success_count == FCM_BATCH_SIZE
    assert result.invalid_tokens == ["dead"]
    assert result.transient_errors == []
    assert result.message_id == "id:device-0"


@pytest.mark.asyncio
async def test_fcm_prunes_invalid_tokens_before_reporting_failed_delivery(
    tmp_path, monkeypatch
) -> None:
    settings = Settings(
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'fcm.db').as_posix()}",
    )
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    user_id = uuid4()
    await create_schema(engine)
    async with factory() as session:
        session.add(User(id=user_id, email="push@example.com"))
        session.add(
            DevicePushToken(
                user_id=user_id,
                token="dead",
                platform=DevicePlatform.android,
            )
        )
        await session.commit()
    await engine.dispose()

    sender = FcmReminderSender(settings)
    monkeypatch.setattr(
        sender,
        "_send_sync",
        lambda tokens, reminder: FcmSendResult(None, ["dead"], [], 0),
    )

    with pytest.raises(RuntimeError, match="rejected every"):
        await sender.send(payload(user_id=user_id), idempotency_key="test", request_id="request")

    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        assert await session.scalar(select(DevicePushToken.id)) is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_fcm_rejects_non_push_channels() -> None:
    sender = FcmReminderSender(Settings(clerk_auth_enabled=False))

    with pytest.raises(ValueError, match="email"):
        await sender.send(
            payload(channel=NotificationChannel.email),
            idempotency_key="test",
            request_id="request",
        )
