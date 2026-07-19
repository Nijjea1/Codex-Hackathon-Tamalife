from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import User
from tamalife_backend.main import create_app


@asynccontextmanager
async def clerk_client(
    tmp_path: Path,
    state: MagicMock,
) -> AsyncIterator[tuple[httpx.AsyncClient, MagicMock, FastAPI]]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'auth.db').as_posix()}",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=True,
        clerk_auth_enabled=True,
        clerk_secret_key="sk_test_dummy",
        clerk_authorized_parties=["tamalife://"],
        extraction_provider="heuristic",
        cache_enabled=False,
    )
    app = create_app(settings)
    fake_client = MagicMock()
    fake_client.authenticate_request.return_value = state
    fake_client.users.get.return_value.model_dump.return_value = {
        "id": "user_from_clerk",
        "primary_email_address_id": "email_primary",
        "email_addresses": [{"id": "email_primary", "email_address": "clerk-user@example.com"}],
        "first_name": "Clerk",
        "last_name": "User",
        "image_url": "https://img.clerk.com/user.png",
    }
    with patch("tamalife_backend.services.auth._clerk_client", return_value=fake_client):
        async with app.router.lifespan_context(app):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                yield client, fake_client, app


async def test_clerk_protected_routes_require_bearer_token(tmp_path: Path) -> None:
    state = MagicMock(is_signed_in=False, reason="no_session_token")
    async with clerk_client(tmp_path, state) as (client, fake_client, _):
        response = await client.get("/v1/me")
        subscriptions = await client.get("/v1/subscriptions")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
    assert subscriptions.status_code == 401
    fake_client.authenticate_request.assert_not_called()


async def test_clerk_rejects_malformed_bearer_header(tmp_path: Path) -> None:
    state = MagicMock(is_signed_in=False)
    async with clerk_client(tmp_path, state) as (client, fake_client, _):
        response = await client.get("/v1/me", headers={"Authorization": "Basic invalid"})
    assert response.status_code == 401
    fake_client.authenticate_request.assert_not_called()


@pytest.mark.parametrize(
    "reason",
    ["token_invalid", "token_expired", "authorized_party_mismatch"],
)
async def test_clerk_rejects_invalid_sessions(tmp_path: Path, reason: str) -> None:
    state = MagicMock(is_signed_in=False, reason=reason)
    async with clerk_client(tmp_path, state) as (client, _, _):
        response = await client.get("/v1/me", headers={"Authorization": "Bearer rejected"})
    assert response.status_code == 401
    assert response.json()["error"]["detail"] == {"reason": reason}


async def test_clerk_identity_is_persisted_and_reused(tmp_path: Path) -> None:
    state = MagicMock(
        is_signed_in=True,
        payload={"sub": "user_123", "sid": "sess_abc", "azp": "tamalife"},
    )
    async with clerk_client(tmp_path, state) as (client, fake_client, app):
        first = await client.get("/v1/me", headers={"Authorization": "Bearer valid"})
        second = await client.get("/v1/me", headers={"Authorization": "Bearer valid"})
        async with app.state.session_factory() as session:
            persisted = await session.scalar(select(User).where(User.clerk_user_id == "user_123"))
    assert first.status_code == 200
    assert first.json()["clerk_user_id"] == "user_123"
    assert first.json()["session_id"] == "sess_abc"
    assert first.json()["user_id"] == second.json()["user_id"]
    assert persisted is not None
    assert persisted.email == "clerk-user@example.com"
    assert persisted.display_name == "Clerk User"
    fake_client.users.get.assert_called_once_with(user_id="user_123")
    options = fake_client.authenticate_request.call_args.args[1]
    assert options.accepts_token == ["session_token"]
    assert options.authorized_parties == ["tamalife://"]


async def test_clerk_rejects_token_without_subject(tmp_path: Path) -> None:
    state = MagicMock(is_signed_in=True, payload={"sid": "sess_abc"})
    async with clerk_client(tmp_path, state) as (client, _, _):
        response = await client.get("/v1/me", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_disabled_local_user_is_rejected(tmp_path: Path) -> None:
    state = MagicMock(is_signed_in=True, payload={"sub": "user_disabled", "sid": "session"})
    async with clerk_client(tmp_path, state) as (client, _, app):
        created = await client.get("/v1/me", headers={"Authorization": "Bearer valid"})
        assert created.status_code == 200
        async with app.state.session_factory() as session:
            user = await session.scalar(select(User).where(User.clerk_user_id == "user_disabled"))
            assert user is not None
            user.disabled_at = datetime.now(UTC)
            await session.commit()
        rejected = await client.get("/v1/me", headers={"Authorization": "Bearer valid"})
    assert rejected.status_code == 403
    assert rejected.json()["error"]["code"] == "account_disabled"


async def test_user_cannot_access_another_users_subscription(
    tmp_path: Path, subscription_payload: dict[str, object]
) -> None:
    state = MagicMock(is_signed_in=True, payload={"sub": "owner", "sid": "owner_session"})
    async with clerk_client(tmp_path, state) as (client, fake_client, _):
        created = await client.post(
            "/v1/subscriptions",
            headers={"Authorization": "Bearer owner"},
            json=subscription_payload,
        )
        assert created.status_code == 201
        fake_client.authenticate_request.return_value = MagicMock(
            is_signed_in=True,
            payload={"sub": "attacker", "sid": "attacker_session"},
        )
        accessed = await client.get(
            f"/v1/subscriptions/{created.json()['id']}",
            headers={"Authorization": "Bearer attacker"},
        )
    assert accessed.status_code == 404
