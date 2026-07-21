from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    PricingSource,
    Provider,
    SourceFetch,
    SourceFetchStatus,
    SourceType,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.safe_fetch import FetchResult
from tamalife_backend.services.source_monitoring import monitor_pricing_source


async def test_monitoring_persists_extracted_snapshot_and_clears_lease(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'monitor.db').as_posix()}",
    )
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)

    async def fake_fetch(*_args: object, **_kwargs: object) -> FetchResult:
        body = b"<div>Premium $19.99 per month</div>"
        return FetchResult(
            "https://example.com/pricing",
            200,
            "text/html",
            body,
            "content-hash",
            '"etag"',
            "Sun, 20 Jul 2026 00:00:00 GMT",
            12,
        )

    monkeypatch.setattr("tamalife_backend.services.source_monitoring.fetch_url", fake_fetch)
    token = str(uuid4())
    async with factory() as session:
        provider = Provider(name="Example", slug="example")
        session.add(provider)
        await session.flush()
        source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://example.com/pricing",
            normalized_url_hash="a" * 64,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
            lease_token=token,
            lease_expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )
        session.add(source)
        await session.commit()
        outcome = await monitor_pricing_source(
            session, settings, source.id, lease_token=token, request_id="req-monitor"
        )
        await session.commit()
        assert outcome.status is SourceFetchStatus.extracted
        assert outcome.changed is True
        assert source.lease_token is None
        assert source.content_hash == "content-hash"
        fetch = await session.get(SourceFetch, outcome.fetch_id)
        assert fetch is not None and fetch.extracted_data is not None
        assert fetch.extracted_data["plans"][0]["name"] == "Premium"
    await engine.dispose()


async def test_monitoring_rejects_unowned_lease(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'lease.db').as_posix()}",
    )
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    async with factory() as session:
        provider = Provider(name="Example", slug="example")
        session.add(provider)
        await session.flush()
        source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://example.com/pricing",
            normalized_url_hash="b" * 64,
            source_type=SourceType.pricing,
            country="CA",
            lease_token="owned",
        )
        session.add(source)
        await session.commit()
        with pytest.raises(ValueError, match="lease"):
            await monitor_pricing_source(
                session, settings, source.id, lease_token="wrong", request_id="req"
            )
    await engine.dispose()
