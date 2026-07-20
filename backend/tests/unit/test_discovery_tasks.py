from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest

from tamalife_backend.config import Settings
from tamalife_backend.tasks import discovery
from tamalife_backend.tasks.celery_app import build_beat_schedule, celery_app


def discovery_settings(*, enabled: bool) -> Settings:
    return Settings(
        environment="test",
        clerk_auth_enabled=False,
        discovery_enabled=enabled,
        openai_api_key="test-key" if enabled else None,
        discovery_interval_days=30,
    )


def test_monthly_beat_entry_is_absent_when_discovery_is_disabled() -> None:
    schedule = build_beat_schedule(discovery_settings(enabled=False))

    assert "discover-pricing-sources-monthly" not in schedule
    assert "scan-reminders-hourly" in schedule
    assert "cleanup-abandoned-receipts-daily" in schedule


def test_monthly_beat_entry_is_bounded_by_configured_interval() -> None:
    settings = discovery_settings(enabled=True)
    schedule = build_beat_schedule(settings)

    entry = schedule["discover-pricing-sources-monthly"]
    assert entry["task"] == "tamalife.schedule_source_discovery"
    assert entry["schedule"] == float(settings.discovery_interval_days * 86400)


def test_discovery_tasks_are_registered() -> None:
    celery_app.loader.import_default_modules()

    assert "tamalife.schedule_source_discovery" in celery_app.tasks
    assert "tamalife.discover_provider_sources" in celery_app.tasks


def test_manual_tasks_do_nothing_when_discovery_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(discovery, "settings", discovery_settings(enabled=False))

    async def unexpected_dispatch(_config: Settings, _request_id: str) -> int:
        raise AssertionError("disabled discovery must not load or dispatch providers")

    async def unexpected_discovery(
        _provider_id: UUID, *, config: Settings, request_id: str
    ) -> dict[str, Any]:
        del config, request_id
        raise AssertionError("disabled discovery must not call the service")

    monkeypatch.setattr(discovery, "_dispatch_monthly", unexpected_dispatch)
    monkeypatch.setattr(discovery, "_discover_provider", unexpected_discovery)

    assert discovery.schedule_source_discovery.run() == 0
    assert discovery.discover_provider_sources_task.run(str(uuid4())) == {"status": "disabled"}


@pytest.mark.asyncio
async def test_monthly_dispatch_is_bounded_and_propagates_request_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = discovery_settings(enabled=True)
    provider_ids = [uuid4(), uuid4()]
    calls: list[tuple[list[str], dict[str, str]]] = []

    async def provider_batch(config: Settings) -> list[UUID]:
        assert config is settings
        return provider_ids

    def capture_dispatch(*, args: list[str], headers: dict[str, str]) -> None:
        calls.append((args, headers))

    monkeypatch.setattr(discovery, "_active_provider_ids", provider_batch)
    monkeypatch.setattr(
        discovery.discover_provider_sources_task,
        "apply_async",
        capture_dispatch,
    )

    count = await discovery._dispatch_monthly(settings, "request-123")

    assert count == 2
    assert calls == [
        ([str(provider_ids[0])], {"request_id": "request-123"}),
        ([str(provider_ids[1])], {"request_id": "request-123"}),
    ]


def test_provider_task_calls_service_boundary_with_request_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = discovery_settings(enabled=True)
    provider_id = uuid4()
    calls: list[tuple[UUID, Settings, str]] = []

    async def capture_discovery(
        value: UUID, *, config: Settings, request_id: str
    ) -> dict[str, Any]:
        calls.append((value, config, request_id))
        return {
            "run_id": str(uuid4()),
            "status": "completed",
            "candidate_count": 3,
            "reused": False,
        }

    monkeypatch.setattr(discovery, "settings", settings)
    monkeypatch.setattr(discovery, "_task_request_id", lambda _task: "request-provider")
    monkeypatch.setattr(discovery, "_discover_provider", capture_discovery)

    result = discovery.discover_provider_sources_task.run(str(provider_id))

    assert result["status"] == "completed"
    assert result["candidate_count"] == 3
    assert calls == [(provider_id, settings, "request-provider")]
