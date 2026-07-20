from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select

from tamalife_backend.api.widget import hash_widget_token
from tamalife_backend.config import Settings
from tamalife_backend.db.models import User, WidgetToken
from tamalife_backend.main import create_app


class RecordingCache:
    def __init__(self) -> None:
        self.values: dict[str, dict[str, Any]] = {}
        self.deleted: list[str] = []

    async def get_json(self, key: str) -> dict[str, Any] | None:
        return self.values.get(key)

    async def set_json(self, key: str, value: dict[str, Any], ttl: int) -> None:
        del ttl
        self.values[key] = value

    async def delete(self, key: str) -> None:
        self.deleted.append(key)
        self.values.pop(key, None)

    async def close(self) -> None:
        return


@pytest.fixture
async def widget_client(
    tmp_path: Path,
) -> AsyncIterator[tuple[httpx.AsyncClient, FastAPI, RecordingCache]]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'widget.db').as_posix()}",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=True,
        clerk_auth_enabled=False,
        extraction_provider="heuristic",
        cache_enabled=False,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        cache = RecordingCache()
        app.state.cache = cache
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, app, cache


async def test_widget_token_lifecycle_is_scoped_and_hashed(
    widget_client: tuple[httpx.AsyncClient, FastAPI, RecordingCache],
) -> None:
    client, app, _ = widget_client
    minted = await client.post("/v1/widget/tokens")
    assert minted.status_code == 201, minted.text
    first = minted.json()
    assert first["scope"] == "widget:read"
    assert first["token"].startswith("tlw_")

    async with app.state.session_factory() as session:
        record = await session.scalar(
            select(WidgetToken).where(WidgetToken.id == UUID(first["id"]))
        )
        assert record is not None
        assert record.scope == "widget:read"
        assert record.token_hash == hash_widget_token(first["token"])
        assert first["token"] not in record.token_hash
        record.scope = "widget:write"
        await session.commit()
    assert (
        await client.get(
            "/v1/widget/summary",
            headers={"Authorization": f"Bearer {first['token']}"},
        )
    ).status_code == 401
    async with app.state.session_factory() as session:
        record = await session.get(WidgetToken, UUID(first["id"]))
        assert record is not None
        record.scope = "widget:read"
        await session.commit()

    listing = await client.get("/v1/widget/tokens")
    assert listing.status_code == 200
    assert listing.json()["items"][0]["id"] == first["id"]
    assert "token" not in listing.json()["items"][0]

    other_revoke = await client.delete(
        f"/v1/widget/tokens/{first['id']}",
        headers={"X-User-ID": "00000000-0000-0000-0000-000000000002"},
    )
    assert other_revoke.status_code == 404

    rotated = await client.post(f"/v1/widget/tokens/{first['id']}/rotate")
    assert rotated.status_code == 200
    second = rotated.json()
    assert second["id"] != first["id"]
    assert (
        await client.get(
            "/v1/widget/summary",
            headers={"Authorization": f"Bearer {first['token']}"},
        )
    ).status_code == 401
    assert (
        await client.get(
            "/v1/widget/summary",
            headers={"Authorization": f"Bearer {second['token']}"},
        )
    ).status_code == 200

    revoked = await client.delete(f"/v1/widget/tokens/{second['id']}")
    assert revoked.status_code == 204
    assert (
        await client.get(
            "/v1/widget/summary",
            headers={"Authorization": f"Bearer {second['token']}"},
        )
    ).status_code == 401


async def test_disabled_or_deleted_owner_cannot_use_widget_token(
    widget_client: tuple[httpx.AsyncClient, FastAPI, RecordingCache],
) -> None:
    client, app, _ = widget_client
    minted = (await client.post("/v1/widget/tokens")).json()

    async with app.state.session_factory() as session:
        user = await session.get(User, app.state.settings.default_user_id)
        assert user is not None
        user.disabled_at = datetime.now(UTC)
        await session.commit()
    response = await client.get(
        "/v1/widget/summary",
        headers={"Authorization": f"Bearer {minted['token']}"},
    )
    assert response.status_code == 401

    async with app.state.session_factory() as session:
        user = await session.get(User, app.state.settings.default_user_id)
        assert user is not None
        user.disabled_at = None
        user.deleted_at = datetime.now(UTC)
        await session.commit()
    response = await client.get(
        "/v1/widget/summary",
        headers={"Authorization": f"Bearer {minted['token']}"},
    )
    assert response.status_code == 401


async def test_summary_cache_is_invalidated_by_create_and_parse_confirmation(
    widget_client: tuple[httpx.AsyncClient, FastAPI, RecordingCache],
    subscription_payload: dict[str, object],
) -> None:
    client, _, cache = widget_client
    token = (await client.post("/v1/widget/tokens")).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    initial = await client.get("/v1/widget/summary", headers=headers)
    assert initial.json()["active_count"] == 0
    assert cache.values

    created = await client.post("/v1/subscriptions", json=subscription_payload)
    assert created.status_code == 201
    assert cache.deleted
    after_create = await client.get("/v1/widget/summary", headers=headers)
    assert after_create.json()["active_count"] == 1

    cache.deleted.clear()
    updated = await client.patch(
        f"/v1/subscriptions/{created.json()['id']}",
        json={"amount": "21.00"},
    )
    assert updated.status_code == 200
    assert cache.deleted

    cache.deleted.clear()
    resolved = await client.patch(
        f"/v1/subscriptions/{created.json()['id']}/resolve",
        json={"action": "renew", "next_date": "2026-10-01"},
    )
    assert resolved.status_code == 200
    assert cache.deleted
    assert (await client.get("/v1/widget/summary", headers=headers)).status_code == 200
    assert cache.values

    parsed = await client.post(
        "/v1/parse",
        data={"text": "CloudBox monthly plan renews 2026-09-01 for $8.00"},
    )
    assert parsed.status_code == 200
    confirmed = await client.post(
        f"/v1/parse/{parsed.json()['id']}/confirm",
        json={
            "extracted": parsed.json()["extracted"],
            "creature_name": "Pixel",
            "creature_species": "blob",
        },
    )
    assert confirmed.status_code == 201
    after_confirm = await client.get("/v1/widget/summary", headers=headers)
    assert after_confirm.json()["active_count"] == 2

    cache.deleted.clear()
    archived = await client.delete(f"/v1/subscriptions/{created.json()['id']}")
    assert archived.status_code == 204
    assert cache.deleted
    after_archive = await client.get("/v1/widget/summary", headers=headers)
    assert after_archive.json()["active_count"] == 1
