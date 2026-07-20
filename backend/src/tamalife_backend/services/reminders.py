from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from typing import Any, Protocol
from uuid import UUID

import httpx
import structlog
from sqlalchemy import delete, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    DevicePushToken,
    NotificationChannel,
    ReminderDelivery,
    Subscription,
    User,
)
from tamalife_backend.db.session import create_engine, create_session_factory

logger = structlog.get_logger()


@dataclass(frozen=True)
class ReminderPayload:
    delivery_id: UUID
    user_id: UUID
    clerk_user_id: str | None
    email: str | None
    subscription_id: UUID
    display_name: str
    vendor_name: str
    renewal_or_expiry_date: str
    channel: NotificationChannel
    days_before: int

    def to_json(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["delivery_id"] = str(self.delivery_id)
        payload["user_id"] = str(self.user_id)
        payload["subscription_id"] = str(self.subscription_id)
        payload["channel"] = self.channel.value
        return payload


class ReminderSender(Protocol):
    async def send(
        self, payload: ReminderPayload, *, idempotency_key: str, request_id: str
    ) -> str | None: ...


class LogReminderSender:
    async def send(self, payload: ReminderPayload, *, idempotency_key: str, request_id: str) -> str:
        await logger.ainfo(
            "reminder_delivery_logged",
            delivery_id=str(payload.delivery_id),
            channel=payload.channel.value,
            request_id=request_id,
        )
        return f"log:{idempotency_key}"


class WebhookReminderSender:
    def __init__(self, url: str, token: str | None, timeout_seconds: float = 10.0) -> None:
        self.url = url
        self.token = token
        self.timeout_seconds = timeout_seconds

    async def send(
        self, payload: ReminderPayload, *, idempotency_key: str, request_id: str
    ) -> str | None:
        headers = {
            "Idempotency-Key": idempotency_key,
            "X-Request-ID": request_id,
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(self.url, json=payload.to_json(), headers=headers)
            response.raise_for_status()
        message_id = response.headers.get("X-Message-ID")
        if message_id:
            return str(message_id)[:300]
        try:
            body = response.json()
        except ValueError:
            return None
        value = body.get("id") if isinstance(body, dict) else None
        return str(value)[:300] if value is not None else None


FIREBASE_APP_NAME = "tamalife-reminders"
# Firebase error codes meaning the token will never work again, so the row is
# pruned instead of retried.
PERMANENT_FCM_ERRORS = frozenset({"UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"})


class FcmReminderSender:
    """Delivers push reminders through Firebase Cloud Messaging.

    Fans a reminder out to every device the user has registered in one batched
    FCM request, pruning tokens Firebase reports as permanently dead. Only the
    push channel is handled; FCM has no email transport, so email deliveries
    fall through as a no-op rather than failing the delivery.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._app: Any = None

    def _ensure_app(self) -> Any:
        if self._app is not None:
            return self._app

        import firebase_admin
        from firebase_admin import credentials

        try:
            self._app = firebase_admin.get_app(FIREBASE_APP_NAME)
        except ValueError:
            raw = self.settings.firebase_credentials_json
            if not raw:
                raise RuntimeError("Firebase credentials are not configured") from None
            cred = credentials.Certificate(json.loads(raw))
            try:
                self._app = firebase_admin.initialize_app(cred, name=FIREBASE_APP_NAME)
            except ValueError:
                # Another worker thread initialised it between our two calls.
                self._app = firebase_admin.get_app(FIREBASE_APP_NAME)
        return self._app

    def _send_sync(
        self, tokens: list[str], payload: ReminderPayload
    ) -> tuple[str | None, list[str]]:
        """Send to every token in one batch. Returns (message id, dead tokens)."""
        from firebase_admin import messaging

        app = self._ensure_app()
        notification = messaging.Notification(
            title="Renewal coming up",
            body=(
                f"{payload.display_name} renews on {payload.renewal_or_expiry_date} "
                f"({payload.days_before} days away)."
            ),
        )
        data = {
            "delivery_id": str(payload.delivery_id),
            "subscription_id": str(payload.subscription_id),
            "days_before": str(payload.days_before),
        }
        batch = messaging.send_each(
            [messaging.Message(token=t, notification=notification, data=data) for t in tokens],
            app=app,
        )

        message_id: str | None = None
        invalid: list[str] = []
        errors: list[str] = []
        for token, result in zip(tokens, batch.responses, strict=True):
            if result.success:
                message_id = message_id or result.message_id
                continue
            exc = result.exception
            code = getattr(exc, "code", "") or type(exc).__name__
            if code in PERMANENT_FCM_ERRORS:
                invalid.append(token)
            else:
                errors.append(f"{code}: {exc}")

        # Retry only when a live token failed for a transient reason; dead
        # tokens alone are terminal and would just burn the retry budget.
        if errors and message_id is None:
            raise RuntimeError("; ".join(errors))
        return message_id, invalid

    async def send(
        self, payload: ReminderPayload, *, idempotency_key: str, request_id: str
    ) -> str | None:
        if payload.channel != NotificationChannel.push:
            await logger.awarning(
                "reminder_delivery_fcm_skipped_channel",
                channel=payload.channel.value,
                request_id=request_id,
            )
            return f"fcm-skip:{idempotency_key}"

        # A fresh engine per delivery: each Celery task runs its own event
        # loop, so an engine cached on this instance would outlive its loop.
        engine = create_engine(self.settings)
        factory = create_session_factory(engine)
        try:
            async with factory() as session:
                tokens = list(
                    (
                        await session.scalars(
                            select(DevicePushToken.token).where(
                                DevicePushToken.user_id == payload.user_id
                            )
                        )
                    ).all()
                )
            if not tokens:
                await logger.ainfo(
                    "reminder_delivery_fcm_no_tokens",
                    user_id=str(payload.user_id),
                    request_id=request_id,
                )
                return f"fcm-no-tokens:{idempotency_key}"

            message_id, invalid = await asyncio.to_thread(self._send_sync, tokens, payload)

            if invalid:
                async with factory() as session:
                    await session.execute(
                        delete(DevicePushToken).where(DevicePushToken.token.in_(invalid))
                    )
                    await session.commit()
            return message_id
        finally:
            await engine.dispose()


def create_reminder_sender(settings: Settings) -> ReminderSender:
    if settings.reminder_delivery_provider == "webhook":
        assert settings.reminder_delivery_webhook_url
        return WebhookReminderSender(
            settings.reminder_delivery_webhook_url,
            settings.reminder_delivery_webhook_token,
        )
    if settings.reminder_delivery_provider == "fcm":
        return FcmReminderSender(settings)
    return LogReminderSender()


def build_reminder_payload(
    delivery: ReminderDelivery, subscription: Subscription, user: User
) -> ReminderPayload:
    target_date = subscription.renewal_or_expiry_date
    if target_date is None:
        raise ValueError("A reminder delivery requires a subscription target date")
    return ReminderPayload(
        delivery_id=delivery.id,
        user_id=user.id,
        clerk_user_id=user.clerk_user_id,
        email=user.email,
        subscription_id=subscription.id,
        display_name=subscription.display_name,
        vendor_name=subscription.vendor_name,
        renewal_or_expiry_date=target_date.isoformat(),
        channel=delivery.channel,
        days_before=delivery.threshold_days,
    )
