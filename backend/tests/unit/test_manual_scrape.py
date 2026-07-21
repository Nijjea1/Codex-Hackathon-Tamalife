from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    ItemType,
    PricingSource,
    Provider,
    SourceType,
    Subscription,
    User,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.manual_scrape import ManualScrapeOptions, run_manual_scrape


async def _settings(tmp_path: Path) -> Settings:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'manual.db').as_posix()}",
    )
    engine = create_engine(settings)
    await create_schema(engine)
    await engine.dispose()
    return settings


async def test_one_shot_monitors_and_refreshes_without_celery(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = await _settings(tmp_path)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        user = User(email="demo@example.com")
        provider = Provider(name="Example", slug="example")
        session.add_all([user, provider])
        await session.flush()
        source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://example.com/pricing",
            normalized_url_hash="e" * 64,
            source_type=SourceType.pricing,
            country="CA",
            next_check_at=datetime.now(UTC),
        )
        subscription = Subscription(
            user_id=user.id,
            vendor_name="Example",
            display_name="Example plan",
            item_type=ItemType.subscription,
            amount="10.00",
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
        )
        session.add_all([source, subscription])
        await session.commit()

    async def monitor(*_args: object, **_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(changed=True)

    async def match(*_args: object, **_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(created=1)

    async def recommend(*_args: object, **_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(recommendations_created=2, alerts_created=1)

    monkeypatch.setattr("tamalife_backend.services.manual_scrape.monitor_pricing_source", monitor)
    monkeypatch.setattr("tamalife_backend.services.manual_scrape.match_user_subscriptions", match)
    monkeypatch.setattr(
        "tamalife_backend.services.manual_scrape.generate_user_recommendations", recommend
    )
    report = await run_manual_scrape(settings, ManualScrapeOptions(force=True))
    assert report.sources_monitored == 1
    assert report.sources_changed == 1
    assert report.users_refreshed == 1
    assert report.matches_created == 1
    assert report.recommendations_created == 2
    assert report.alerts_created == 1
    assert report.errors == []
    await engine.dispose()


async def test_one_shot_can_seed_demo_providers_from_subscriptions(tmp_path: Path) -> None:
    settings = await _settings(tmp_path)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        user = User(email="demo@example.com")
        session.add(user)
        await session.flush()
        session.add(
            Subscription(
                user_id=user.id,
                vendor_name="Example Plus",
                display_name="Example plan",
                item_type=ItemType.subscription,
                category="Entertainment",
                amount="10.00",
                currency="CAD",
                billing_cycle=BillingCycle.monthly,
            )
        )
        await session.commit()
    report = await run_manual_scrape(
        settings,
        ManualScrapeOptions(
            seed_providers_from_subscriptions=True,
            monitor=False,
            refresh=False,
        ),
    )
    assert report.providers_seeded == 1
    async with factory() as session:
        provider = await session.scalar(select(Provider))
        assert provider is not None
        assert provider.slug == "example-plus"
        assert provider.official_domain is None
        assert provider.policy_status == "demo_pending"
    await engine.dispose()


async def test_one_shot_seeding_deduplicates_provider_slugs_with_mixed_categories(
    tmp_path: Path,
) -> None:
    settings = await _settings(tmp_path)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        user = User(email="demo@example.com")
        session.add(user)
        await session.flush()
        for category in ("Productivity", "Other"):
            session.add(
                Subscription(
                    user_id=user.id,
                    vendor_name="Anthropic, PBC",
                    display_name="Claude",
                    item_type=ItemType.subscription,
                    category=category,
                    amount="20.00",
                    currency="CAD",
                    billing_cycle=BillingCycle.monthly,
                )
            )
        await session.commit()

    report = await run_manual_scrape(
        settings,
        ManualScrapeOptions(seed_providers_from_subscriptions=True, monitor=False, refresh=False),
    )
    assert report.providers_seeded == 1
    async with factory() as session:
        providers = list((await session.scalars(select(Provider))).all())
        assert [provider.slug for provider in providers] == ["anthropic-pbc"]
    await engine.dispose()


async def test_one_shot_releases_lease_and_reports_sanitized_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = await _settings(tmp_path)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        provider = Provider(name="Example", slug="example")
        session.add(provider)
        await session.flush()
        source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://example.com/pricing",
            normalized_url_hash="f" * 64,
            source_type=SourceType.pricing,
            country="CA",
            next_check_at=datetime.now(UTC),
        )
        session.add(source)
        await session.commit()
        source_id = source.id

    async def fail(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("secret upstream response")

    monkeypatch.setattr("tamalife_backend.services.manual_scrape.monitor_pricing_source", fail)
    report = await run_manual_scrape(settings, ManualScrapeOptions(force=True, refresh=False))
    assert report.errors == [
        {"stage": "monitoring", "item_id": str(source_id), "error_type": "RuntimeError"}
    ]
    async with factory() as session:
        persisted = await session.scalar(select(PricingSource).where(PricingSource.id == source_id))
        assert persisted is not None and persisted.lease_token is None
    await engine.dispose()
