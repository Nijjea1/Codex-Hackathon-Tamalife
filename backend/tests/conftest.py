from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

os.environ["TAMALIFE_CLERK_AUTH_ENABLED"] = "false"
os.environ["TAMALIFE_STORAGE_BACKEND"] = "local"

from tamalife_backend.config import Settings
from tamalife_backend.main import create_app


@pytest.fixture
async def client(tmp_path: Path) -> AsyncIterator[httpx.AsyncClient]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=True,
        clerk_auth_enabled=False,
        extraction_provider="heuristic",
        cache_enabled=False,
        max_upload_bytes=512,
        max_request_body_bytes=1024,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as value:
            yield value


@pytest.fixture
def subscription_payload() -> dict[str, object]:
    return {
        "vendor_name": "StreamFlix",
        "display_name": "Video Streaming",
        "item_type": "subscription",
        "category": "Entertainment",
        "amount": "19.99",
        "previous_amount": "17.99",
        "currency": "usd",
        "billing_cycle": "monthly",
        "renewal_or_expiry_date": "2026-08-12",
        "cancellation_difficulty": "moderate",
        "creature_name": "Nova",
        "creature_species": "gem",
    }
