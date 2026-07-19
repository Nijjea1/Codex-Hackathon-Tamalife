from __future__ import annotations

import base64
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

import httpx
from fastapi import FastAPI
from sqlalchemy import func, select
from svix.webhooks import Webhook

from tamalife_backend.config import Settings
from tamalife_backend.db.models import ClerkWebhookEvent, User
from tamalife_backend.main import create_app

WEBHOOK_SECRET = "whsec_" + base64.b64encode(b"tamalife-test-webhook-secret-32b").decode()


@asynccontextmanager
async def webhook_client(tmp_path: Path) -> AsyncIterator[tuple[httpx.AsyncClient, FastAPI]]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'webhooks.db').as_posix()}",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=True,
        clerk_auth_enabled=False,
        clerk_webhook_signing_secret=WEBHOOK_SECRET,
        extraction_provider="heuristic",
        cache_enabled=False,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, app


def signed_event(
    event_id: str, event_type: str, data: dict[str, object]
) -> tuple[str, dict[str, str]]:
    body = json.dumps({"type": event_type, "data": data}, separators=(",", ":"))
    timestamp = datetime.now(UTC)
    signature = Webhook(WEBHOOK_SECRET).sign(event_id, timestamp, body)
    return body, {
        "content-type": "application/json",
        "svix-id": event_id,
        "svix-timestamp": str(int(timestamp.timestamp())),
        "svix-signature": signature,
    }


async def test_webhook_rejects_invalid_signature(tmp_path: Path) -> None:
    async with webhook_client(tmp_path) as (client, _):
        response = await client.post(
            "/v1/webhooks/clerk",
            content='{"type":"user.created","data":{"id":"user_1"}}',
            headers={
                "svix-id": "msg_invalid",
                "svix-timestamp": str(int(datetime.now(UTC).timestamp())),
                "svix-signature": "v1,invalid",
            },
        )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_webhook_signature"


async def test_user_webhook_lifecycle_and_duplicate_delivery(tmp_path: Path) -> None:
    created_data: dict[str, object] = {
        "id": "user_webhook",
        "first_name": "Tama",
        "last_name": "Friend",
        "image_url": "https://example.com/avatar.png",
        "primary_email_address_id": "email_1",
        "email_addresses": [{"id": "email_1", "email_address": "tama@example.com"}],
    }
    async with webhook_client(tmp_path) as (client, app):
        body, headers = signed_event("msg_created", "user.created", created_data)
        created = await client.post("/v1/webhooks/clerk", content=body, headers=headers)
        duplicate = await client.post("/v1/webhooks/clerk", content=body, headers=headers)
        assert created.json() == {"received": True, "duplicate": False}
        assert duplicate.json() == {"received": True, "duplicate": True}

        updated_data = {**created_data, "first_name": "Updated", "banned": True}
        body, headers = signed_event("msg_updated", "user.updated", updated_data)
        updated = await client.post("/v1/webhooks/clerk", content=body, headers=headers)
        assert updated.status_code == 200
        async with app.state.session_factory() as session:
            user = await session.scalar(select(User).where(User.clerk_user_id == "user_webhook"))
            assert user is not None
            assert user.display_name == "Updated Friend"
            assert user.email == "tama@example.com"
            assert user.disabled_at is not None

        body, headers = signed_event(
            "msg_deleted", "user.deleted", {"id": "user_webhook", "deleted": True}
        )
        deleted = await client.post("/v1/webhooks/clerk", content=body, headers=headers)
        assert deleted.status_code == 200
        async with app.state.session_factory() as session:
            user = await session.scalar(select(User).where(User.clerk_user_id == "user_webhook"))
            event_count = await session.scalar(select(func.count()).select_from(ClerkWebhookEvent))
            assert user is not None
            assert user.deleted_at is not None
            assert user.email is None
            assert user.display_name is None
            assert event_count == 3
