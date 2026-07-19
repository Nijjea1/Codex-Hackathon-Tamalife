from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Protocol
from uuid import UUID

import httpx
import structlog

from tamalife_backend.config import Settings
from tamalife_backend.db.models import NotificationChannel, ReminderDelivery, Subscription, User

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


def create_reminder_sender(settings: Settings) -> ReminderSender:
    if settings.reminder_delivery_provider == "webhook":
        assert settings.reminder_delivery_webhook_url
        return WebhookReminderSender(
            settings.reminder_delivery_webhook_url,
            settings.reminder_delivery_webhook_token,
        )
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
