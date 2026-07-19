from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx

from tamalife_backend.config import Settings
from tamalife_backend.main import create_app


@asynccontextmanager
async def clerk_client(
    tmp_path: Path,
    state: MagicMock,
) -> AsyncIterator[tuple[httpx.AsyncClient, MagicMock]]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'auth.db').as_posix()}",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=True,
        clerk_auth_enabled=True,
        clerk_secret_key="sk_test_dummy",
        extraction_provider="heuristic",
        cache_enabled=False,
    )
    app = create_app(settings)
    fake_client = MagicMock()
    fake_client.authenticate_request.return_value = state
    with patch("tamalife_backend.services.auth._clerk_client", return_value=fake_client):
        async with app.router.lifespan_context(app):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                yield client, fake_client


async def test_clerk_protected_routes_require_bearer_token(tmp_path: Path) -> None:
    state = MagicMock(is_signed_in=False, reason="no_session_token")
    async with clerk_client(tmp_path, state) as (client, fake_client):
        response = await client.get("/v1/me")
        subscriptions = await client.get("/v1/subscriptions")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
    assert subscriptions.status_code == 401
    fake_client.authenticate_request.assert_not_called()


async def test_clerk_rejects_signed_out_session(tmp_path: Path) -> None:
    state = MagicMock(is_signed_in=False, reason="token_expired")
    async with clerk_client(tmp_path, state) as (client, _):
        response = await client.get("/v1/me", headers={"Authorization": "Bearer expired"})
    assert response.status_code == 401
    assert response.json()["error"]["detail"] == {"reason": "token_expired"}


async def test_clerk_identity_is_persisted_and_reused(tmp_path: Path) -> None:
    state = MagicMock(
        is_signed_in=True,
        payload={"sub": "user_123", "sid": "sess_abc", "azp": "tamalife"},
    )
    async with clerk_client(tmp_path, state) as (client, _):
        first = await client.get("/v1/me", headers={"Authorization": "Bearer valid"})
        second = await client.get("/v1/me", headers={"Authorization": "Bearer valid"})
    assert first.status_code == 200
    assert first.json()["clerk_user_id"] == "user_123"
    assert first.json()["session_id"] == "sess_abc"
    assert first.json()["user_id"] == second.json()["user_id"]


async def test_clerk_rejects_token_without_subject(tmp_path: Path) -> None:
    state = MagicMock(is_signed_in=True, payload={"sid": "sess_abc"})
    async with clerk_client(tmp_path, state) as (client, _):
        response = await client.get("/v1/me", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
