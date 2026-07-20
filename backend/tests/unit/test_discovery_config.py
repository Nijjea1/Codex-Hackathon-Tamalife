from __future__ import annotations

import pytest
from pydantic import ValidationError

from tamalife_backend.config import Settings


def test_discovery_and_scraper_defaults_are_safe_and_bounded() -> None:
    settings = Settings(clerk_auth_enabled=False)
    assert settings.discovery_enabled is False
    assert settings.discovery_prompt_version == "source-discovery-v1"
    assert settings.discovery_interval_days == 30
    assert settings.discovery_min_auto_activate_confidence == 0.92
    assert settings.discovery_monthly_cost_limit_micros == 25_000_000
    assert settings.discovery_country == "CA"
    assert settings.discovery_currency == "CAD"
    assert settings.scraper_connect_timeout_seconds < settings.scraper_total_timeout_seconds
    assert settings.scraper_read_timeout_seconds < settings.scraper_total_timeout_seconds
    assert settings.scraper_max_response_bytes == 2 * 1024 * 1024
    assert settings.scraper_max_redirects == 3
    assert settings.scraper_missing_plan_threshold == 2


def test_discovery_settings_load_from_prefixed_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TAMALIFE_DISCOVERY_INTERVAL_DAYS", "14")
    monkeypatch.setenv("TAMALIFE_DISCOVERY_COUNTRY", "US")
    monkeypatch.setenv("TAMALIFE_DISCOVERY_CURRENCY", "USD")
    monkeypatch.setenv("TAMALIFE_SCRAPER_SOURCE_BATCH_SIZE", "40")
    settings = Settings(clerk_auth_enabled=False)
    assert settings.discovery_interval_days == 14
    assert settings.discovery_country == "US"
    assert settings.discovery_currency == "USD"
    assert settings.scraper_source_batch_size == 40


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("discovery_interval_days", 6),
        ("discovery_interval_days", 91),
        ("discovery_max_providers_per_run", 0),
        ("discovery_max_searches_per_provider", 11),
        ("discovery_max_candidates_per_provider", 51),
        ("discovery_min_auto_activate_confidence", 1.01),
        ("discovery_monthly_cost_limit_micros", -1),
        ("scraper_connect_timeout_seconds", 0.5),
        ("scraper_read_timeout_seconds", 61),
        ("scraper_total_timeout_seconds", 121),
        ("scraper_max_response_bytes", 1000),
        ("scraper_max_redirects", 6),
        ("scraper_source_batch_size", 0),
        ("scraper_source_lease_seconds", 29),
        ("scraper_missing_plan_threshold", 1),
        ("scraper_monitor_interval_seconds", 299),
    ],
)
def test_discovery_and_scraper_bounds_are_validated(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate({"clerk_auth_enabled": False, field: value})


def test_discovery_requires_openai_key_only_when_enabled() -> None:
    disabled = Settings(
        clerk_auth_enabled=False,
        discovery_enabled=False,
        openai_api_key=None,
    )
    disabled.validate_runtime()

    enabled_without_key = Settings(
        clerk_auth_enabled=False,
        discovery_enabled=True,
        openai_api_key=None,
    )
    with pytest.raises(ValueError, match=r"OPENAI_API_KEY.*discovery"):
        enabled_without_key.validate_runtime()

    enabled = Settings(
        clerk_auth_enabled=False,
        discovery_enabled=True,
        openai_api_key="test-key",
    )
    enabled.validate_runtime()
