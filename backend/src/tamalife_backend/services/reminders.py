from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Any, Protocol
from uuid import UUID

import httpx
import structlog
from sqlalchemy import delete, func, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    DevicePushToken,
    NotificationCategory,
    NotificationChannel,
    ReminderDelivery,
    Subscription,
    SubscriptionStatus,
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
    category: NotificationCategory
    channel: NotificationChannel
    title: str
    body: str
    # Subscription-scoped categories carry these; user-scoped ones leave them None.
    subscription_id: UUID | None = None
    display_name: str | None = None
    vendor_name: str | None = None
    renewal_or_expiry_date: str | None = None
    days_before: int | None = None

    def to_json(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["delivery_id"] = str(self.delivery_id)
        payload["user_id"] = str(self.user_id)
        payload["subscription_id"] = (
            str(self.subscription_id) if self.subscription_id is not None else None
        )
        payload["category"] = self.category.value
        payload["channel"] = self.channel.value
        return payload

    def data(self) -> dict[str, str]:
        """Compact string map delivered to the client for tap routing."""
        values: dict[str, str] = {
            "delivery_id": str(self.delivery_id),
            "category": self.category.value,
        }
        if self.subscription_id is not None:
            values["subscription_id"] = str(self.subscription_id)
        if self.days_before is not None:
            values["days_before"] = str(self.days_before)
        return values


class ReminderSender(Protocol):
    async def send(
        self, payload: ReminderPayload, *, idempotency_key: str, request_id: str
    ) -> str | None: ...


class PermanentDeliveryError(ValueError):
    """A delivery cannot succeed without a configuration or channel change."""


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
FCM_BATCH_SIZE = 500


@dataclass(frozen=True)
class FcmSendResult:
    message_id: str | None
    invalid_tokens: list[str]
    transient_errors: list[str]
    success_count: int


class FcmReminderSender:
    """Delivers push reminders through Firebase Cloud Messaging.

    Fans a reminder out to every device the user has registered in bounded FCM
    batches, pruning tokens Firebase reports as permanently dead. Only the push
    channel is supported; using this sender for another channel fails explicitly
    instead of recording a delivery that never happened.
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

    def _send_sync(self, tokens: list[str], payload: ReminderPayload) -> FcmSendResult:
        """Send to every token in FCM-sized batches and classify failures."""
        from firebase_admin import exceptions as firebase_exceptions
        from firebase_admin import messaging

        app = self._ensure_app()
        notification = messaging.Notification(title=payload.title, body=payload.body)
        data = payload.data()
        android = messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="reminders",
                color="#F3A6C0",
                icon="notification_icon",
                sound="default",
            ),
        )
        apns = messaging.APNSConfig(
            payload=messaging.APNSPayload(aps=messaging.Aps(sound="default"))
        )
        message_id: str | None = None
        invalid: list[str] = []
        errors: list[str] = []
        success_count = 0
        permanent_errors = (
            messaging.UnregisteredError,
            messaging.SenderIdMismatchError,
            firebase_exceptions.InvalidArgumentError,
        )
        for offset in range(0, len(tokens), FCM_BATCH_SIZE):
            chunk = tokens[offset : offset + FCM_BATCH_SIZE]
            batch = messaging.send_each(
                [
                    messaging.Message(
                        token=t,
                        notification=notification,
                        data=data,
                        android=android,
                        apns=apns,
                    )
                    for t in chunk
                ],
                app=app,
            )
            for token, result in zip(chunk, batch.responses, strict=True):
                if result.success:
                    success_count += 1
                    message_id = message_id or result.message_id
                    continue
                exc = result.exception
                if isinstance(exc, permanent_errors):
                    invalid.append(token)
                else:
                    code = getattr(exc, "code", "") or type(exc).__name__
                    errors.append(f"{code}: {exc}")

        return FcmSendResult(message_id, invalid, errors, success_count)

    async def send(
        self, payload: ReminderPayload, *, idempotency_key: str, request_id: str
    ) -> str | None:
        if payload.channel != NotificationChannel.push:
            raise PermanentDeliveryError(
                f"FCM cannot deliver the {payload.channel.value!r} notification channel"
            )

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
                raise RuntimeError("The reminder owner has no registered FCM devices")

            result = await asyncio.to_thread(self._send_sync, tokens, payload)

            if result.invalid_tokens:
                async with factory() as session:
                    await session.execute(
                        delete(DevicePushToken).where(
                            DevicePushToken.token.in_(result.invalid_tokens),
                            DevicePushToken.user_id == payload.user_id,
                        )
                    )
                    await session.commit()

            if result.transient_errors and result.success_count == 0:
                raise RuntimeError("; ".join(result.transient_errors))
            if result.success_count == 0:
                raise RuntimeError("FCM rejected every registered device token")
            if result.transient_errors:
                await logger.awarning(
                    "reminder_delivery_fcm_partial_failure",
                    failed_count=len(result.transient_errors),
                    success_count=result.success_count,
                    request_id=request_id,
                )
            return result.message_id
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


SUBSCRIPTION_CATEGORIES = frozenset(
    {
        NotificationCategory.renewal,
        NotificationCategory.price_hike,
        NotificationCategory.creature_health,
    }
)


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}" + ("" if count == 1 else "s")


def _subscription_content(
    category: NotificationCategory, subscription: Subscription, delivery: ReminderDelivery
) -> tuple[str, str]:
    name = subscription.display_name
    if category == NotificationCategory.renewal:
        target = subscription.renewal_or_expiry_date
        when = target.isoformat() if target else "soon"
        away = _plural(delivery.threshold_days, "day")
        return "Renewal coming up", f"{name} renews on {when} ({away} away)."
    if category == NotificationCategory.price_hike:
        now = f"{subscription.currency} {subscription.amount}"
        if subscription.previous_amount is not None:
            was = subscription.previous_amount
            return "Price went up 📈", f"{name} increased to {now} (was {was})."
        return "Price went up 📈", f"{name} increased to {now}."
    # creature_health
    return (
        f"{subscription.creature_name} needs you 😷",
        f"{name} is looking unwell — its renewal needs attention.",
    )


async def _user_content(
    session: Any, category: NotificationCategory, user: User
) -> tuple[str, str]:
    active = (
        Subscription.user_id == user.id,
        Subscription.archived_at.is_(None),
        Subscription.status == SubscriptionStatus.active,
    )
    if category == NotificationCategory.re_engagement:
        count = await session.scalar(select(func.count()).select_from(Subscription).where(*active))
        return (
            "Your garden misses you 🌱",
            f"You have {_plural(int(count or 0), 'creature')} waiting. Come check on them!",
        )
    # weekly_digest: upcoming renewals in the next 30 days
    horizon = date.today() + timedelta(days=30)
    upcoming = await session.scalar(
        select(func.count())
        .select_from(Subscription)
        .where(
            *active,
            Subscription.renewal_or_expiry_date.is_not(None),
            Subscription.renewal_or_expiry_date <= horizon,
        )
    )
    return (
        "Your weekly garden report 🌼",
        f"{_plural(int(upcoming or 0), 'renewal')} coming up in the next 30 days.",
    )


async def build_reminder_payload(
    session: Any,
    delivery: ReminderDelivery,
    subscription: Subscription | None,
    user: User,
) -> ReminderPayload:
    if delivery.category in SUBSCRIPTION_CATEGORIES:
        if subscription is None:
            raise ValueError(f"{delivery.category.value} requires a subscription")
        title, body = _subscription_content(delivery.category, subscription, delivery)
        target = subscription.renewal_or_expiry_date
        return ReminderPayload(
            delivery_id=delivery.id,
            user_id=user.id,
            clerk_user_id=user.clerk_user_id,
            email=user.email,
            category=delivery.category,
            channel=delivery.channel,
            title=title,
            body=body,
            subscription_id=subscription.id,
            display_name=subscription.display_name,
            vendor_name=subscription.vendor_name,
            renewal_or_expiry_date=target.isoformat() if target else None,
            days_before=delivery.threshold_days,
        )
    title, body = await _user_content(session, delivery.category, user)
    return ReminderPayload(
        delivery_id=delivery.id,
        user_id=user.id,
        clerk_user_id=user.clerk_user_id,
        email=user.email,
        category=delivery.category,
        channel=delivery.channel,
        title=title,
        body=body,
    )
