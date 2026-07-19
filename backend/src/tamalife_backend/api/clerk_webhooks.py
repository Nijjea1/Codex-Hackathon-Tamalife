from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from svix.webhooks import Webhook

from tamalife_backend.api.dependencies import SessionDep, SettingsDep
from tamalife_backend.db.base import utcnow
from tamalife_backend.db.models import ClerkWebhookEvent
from tamalife_backend.errors import ApiError
from tamalife_backend.services.clerk_users import synchronize_clerk_user

router = APIRouter(prefix="/webhooks/clerk", tags=["webhooks"])


def verify_webhook(body: bytes, headers: dict[str, str], secret: str) -> dict[str, Any]:
    try:
        payload = Webhook(secret).verify(body, headers)
    except Exception as exc:
        raise ApiError("invalid_webhook_signature", "Webhook signature is invalid", 400) from exc
    if not isinstance(payload, dict):
        raise ApiError("invalid_webhook_payload", "Webhook payload must be an object", 400)
    return payload


@router.post("")
async def receive_clerk_webhook(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
) -> dict[str, bool]:
    if not settings.clerk_webhook_signing_secret:
        raise ApiError(
            "server_misconfigured", "Clerk webhook signing secret is not configured", 500
        )
    body = await request.body()
    payload = verify_webhook(
        body,
        {key: value for key, value in request.headers.items()},
        settings.clerk_webhook_signing_secret,
    )
    event_id_value = payload.get("id") or request.headers.get("svix-id")
    event_type_value = payload.get("type")
    data_value = payload.get("data")
    if (
        not isinstance(event_id_value, str)
        or not isinstance(event_type_value, str)
        or not isinstance(data_value, dict)
    ):
        raise ApiError("invalid_webhook_payload", "Webhook event fields are invalid", 400)

    event = await session.scalar(
        select(ClerkWebhookEvent).where(ClerkWebhookEvent.clerk_event_id == event_id_value)
    )
    if event is not None and event.processed_at is not None:
        return {"received": True, "duplicate": True}
    if event is None:
        event = ClerkWebhookEvent(
            clerk_event_id=event_id_value,
            event_type=event_type_value,
            payload=payload,
        )
        try:
            async with session.begin_nested():
                session.add(event)
                await session.flush()
        except IntegrityError:
            event = await session.scalar(
                select(ClerkWebhookEvent).where(ClerkWebhookEvent.clerk_event_id == event_id_value)
            )
            if event is not None and event.processed_at is not None:
                return {"received": True, "duplicate": True}
            if event is None:
                raise

    try:
        await synchronize_clerk_user(session, event_type_value, data_value, settings)
    except Exception as exc:
        event.processing_error = str(exc)[:4000]
        await session.flush()
        raise ApiError("webhook_processing_failed", "Webhook could not be processed", 500) from exc
    event.processing_error = None
    event.processed_at = utcnow()
    return {"received": True, "duplicate": False}
