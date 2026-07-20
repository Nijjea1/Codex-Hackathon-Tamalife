from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType, SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import PricingSource, Provider, SourceStatus, SourceType
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.tasks import source_monitoring
from tamalife_backend.tasks.celery_app import build_beat_schedule, celery_app


def monitoring_settings(tmp_path: Path | None = None, *, enabled: bool = True) -> Settings:
    database_url = (
        f"sqlite+aiosqlite:///{(tmp_path / 'monitoring.db').as_posix()}"
        if tmp_path
        else "sqlite+aiosqlite:///:memory:"
    )
    return Settings(
        environment="test",
        clerk_auth_enabled=False,
        scraper_monitoring_enabled=enabled,
        database_url=database_url,
        scraper_source_batch_size=2,
        scraper_source_lease_seconds=60,
        scraper_monitor_interval_seconds=600,
    )


async def add_source(
    settings: Settings,
    *,
    status: SourceStatus = SourceStatus.active,
    next_check_at: datetime,
    lease_token: str | None = None,
    lease_expires_at: datetime | None = None,
) -> UUID:
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            provider = Provider(name=f"Provider {uuid4()}", slug=str(uuid4()))
            session.add(provider)
            await session.flush()
            source = PricingSource(
                provider_id=provider.id,
                canonical_url=f"https://example.com/{uuid4()}",
                normalized_url_hash=uuid4().hex,
                source_type=SourceType.pricing,
                country="CA",
                currency="CAD",
                status=status,
                next_check_at=next_check_at,
                lease_token=lease_token,
                lease_expires_at=lease_expires_at,
            )
            session.add(source)
            await session.commit()
            return source.id
    finally:
        await engine.dispose()


async def load_source(settings: Settings, source_id: UUID) -> PricingSource:
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            return (
                await session.execute(select(PricingSource).where(PricingSource.id == source_id))
            ).scalar_one()
    finally:
        await engine.dispose()


def test_monitoring_beat_is_configuration_gated() -> None:
    disabled = build_beat_schedule(monitoring_settings(enabled=False))
    enabled_settings = monitoring_settings(enabled=True)
    enabled = build_beat_schedule(enabled_settings)

    assert "monitor-pricing-sources" not in disabled
    assert enabled["monitor-pricing-sources"] == {
        "task": "tamalife.schedule_source_monitoring",
        "schedule": float(enabled_settings.scraper_monitor_interval_seconds),
    }


def test_monitoring_tasks_are_registered() -> None:
    celery_app.loader.import_default_modules()

    assert "tamalife.schedule_source_monitoring" in celery_app.tasks
    assert "tamalife.monitor_pricing_source" in celery_app.tasks


def test_disabled_tasks_do_not_claim_or_monitor(monkeypatch: pytest.MonkeyPatch) -> None:
    config = monitoring_settings(enabled=False)
    monkeypatch.setattr(source_monitoring, "settings", config)

    async def unexpected(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("disabled monitoring must not access sources or services")

    monkeypatch.setattr(source_monitoring, "_dispatch_due_sources", unexpected)
    monkeypatch.setattr(source_monitoring, "_monitor_source", unexpected)

    assert source_monitoring.schedule_source_monitoring.run() == 0
    assert source_monitoring.monitor_pricing_source_task.run(str(uuid4()), "lease") == {
        "status": "disabled"
    }


@pytest.mark.asyncio
async def test_claims_only_bounded_due_active_or_failing_sources(tmp_path: Path) -> None:
    config = monitoring_settings(tmp_path)
    now = datetime.now(UTC)
    due_active = await add_source(config, next_check_at=now - timedelta(minutes=3))
    due_failing = await add_source(
        config,
        status=SourceStatus.failing,
        next_check_at=now - timedelta(minutes=2),
        lease_token="expired",
        lease_expires_at=now - timedelta(seconds=1),
    )
    await add_source(config, next_check_at=now - timedelta(minutes=1))
    await add_source(config, status=SourceStatus.paused, next_check_at=now - timedelta(days=1))
    await add_source(config, next_check_at=now + timedelta(days=1))
    await add_source(
        config,
        next_check_at=now - timedelta(days=1),
        lease_token="owned",
        lease_expires_at=now + timedelta(minutes=5),
    )

    leases = await source_monitoring._claim_due_sources(config, now)

    assert [lease.source_id for lease in leases] == [due_active, due_failing]
    assert len({lease.lease_token for lease in leases}) == 2
    for lease in leases:
        persisted = await load_source(config, lease.source_id)
        assert persisted.lease_token == lease.lease_token
        assert persisted.lease_expires_at is not None


@pytest.mark.asyncio
async def test_dispatch_propagates_request_id_and_releases_unpublished_leases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = monitoring_settings()
    leases = [
        source_monitoring.SourceLease(uuid4(), "one"),
        source_monitoring.SourceLease(uuid4(), "two"),
    ]
    released: list[source_monitoring.SourceLease] = []
    calls: list[tuple[list[str], dict[str, str]]] = []

    async def claim(
        _config: Settings, _now: datetime | None = None
    ) -> list[source_monitoring.SourceLease]:
        return leases

    async def release(_config: Settings, values: list[source_monitoring.SourceLease]) -> None:
        released.extend(values)

    def dispatch(*, args: list[str], headers: dict[str, str]) -> None:
        calls.append((args, headers))
        if len(calls) == 2:
            raise RuntimeError("broker unavailable")

    monkeypatch.setattr(source_monitoring, "_claim_due_sources", claim)
    monkeypatch.setattr(source_monitoring, "_release_leases", release)
    monkeypatch.setattr(source_monitoring.monitor_pricing_source_task, "apply_async", dispatch)

    with pytest.raises(RuntimeError, match="broker unavailable"):
        await source_monitoring._dispatch_due_sources(config, "request-123")

    assert calls[0] == (
        [str(leases[0].source_id), leases[0].lease_token],
        {"request_id": "request-123"},
    )
    assert released == [leases[1]]


@pytest.mark.asyncio
async def test_monitor_service_commits_and_clears_matching_lease(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = monitoring_settings(tmp_path)
    now = datetime.now(UTC)
    source_id = await add_source(config, next_check_at=now - timedelta(minutes=1))
    lease = (await source_monitoring._claim_due_sources(config, now))[0]
    calls: list[tuple[UUID, str, str]] = []

    async def monitor(
        session: object,
        settings: Settings,
        value: UUID,
        *,
        lease_token: str,
        request_id: str,
    ) -> object:
        del session
        assert settings is config
        calls.append((value, lease_token, request_id))
        return SimpleNamespace(status="fetched")

    service_module = ModuleType("tamalife_backend.services.source_monitoring")
    service_module.monitor_pricing_source = monitor  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, service_module.__name__, service_module)

    result = await source_monitoring._monitor_source(config, lease, "request-service")

    assert result == {"source_id": str(source_id), "status": "fetched"}
    assert calls == [(source_id, lease.lease_token, "request-service")]
    persisted = await load_source(config, source_id)
    assert persisted.lease_token is None
    assert persisted.lease_expires_at is None


@pytest.mark.asyncio
async def test_monitor_service_failure_rolls_back_before_lease_release(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = monitoring_settings(tmp_path)
    now = datetime.now(UTC)
    source_id = await add_source(config, next_check_at=now - timedelta(minutes=1))
    lease = (await source_monitoring._claim_due_sources(config, now))[0]

    async def fail(
        session: object,
        _settings: Settings,
        _source_id: UUID,
        *,
        lease_token: str,
        request_id: str,
    ) -> object:
        del lease_token, request_id
        source = await session.get(PricingSource, source_id)  # type: ignore[attr-defined]
        source.next_check_at = now + timedelta(days=10)
        raise RuntimeError("fetch failed")

    service_module = ModuleType("tamalife_backend.services.source_monitoring")
    service_module.monitor_pricing_source = fail  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, service_module.__name__, service_module)

    with pytest.raises(RuntimeError, match="fetch failed"):
        await source_monitoring._monitor_source(config, lease, "request-failure")
    before_release = await load_source(config, source_id)
    assert before_release.next_check_at.replace(tzinfo=UTC) < now
    assert before_release.lease_token == lease.lease_token

    await source_monitoring._release_lease(config, lease)
    after_release = await load_source(config, source_id)
    assert after_release.lease_token is None
    assert after_release.lease_expires_at is None
