from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    Deal,
    PlanPriceHistory,
    PricingSource,
    Provider,
    ProviderPlan,
    ReviewStatus,
    SourceFetch,
    SourceFetchStatus,
    SourceType,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.plan_diff import publish_source_fetch
from tamalife_backend.services.pricing_extraction import (
    ExtractedDeal,
    ExtractedPricingCatalog,
    extract_pricing_catalog,
)


async def test_publication_is_idempotent_and_records_only_real_price_changes(
    tmp_path: Path,
) -> None:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'diff.db').as_posix()}",
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
            normalized_url_hash="c" * 64,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
        )
        session.add(source)
        await session.flush()

        async def add_fetch(price: str, content_hash: str) -> SourceFetch:
            catalog = extract_pricing_catalog(
                (
                    '<script type="application/ld+json">'
                    f'{{"@type":"Offer","name":"Premium","price":"{price}",'
                    '"priceCurrency":"CAD","priceSpecification":"per month"}'
                    "</script>"
                ).encode(),
                default_currency="CAD",
            )
            fetch = SourceFetch(
                source_id=source.id,
                request_id=f"req-{price}",
                status=SourceFetchStatus.extracted,
                completed_at=datetime.now(UTC),
                content_hash=content_hash,
                extracted_data=catalog.model_dump(mode="json"),
            )
            session.add(fetch)
            await session.flush()
            return fetch

        first = await add_fetch("10.00", "first")
        result = await publish_source_fetch(session, settings, first.id)
        repeated = await publish_source_fetch(session, settings, first.id)
        assert result.created_plans == 1
        assert repeated.reused is True

        unchanged = await add_fetch("10.00", "second")
        unchanged_result = await publish_source_fetch(session, settings, unchanged.id)
        assert unchanged_result.changed_prices == 0
        increased = await add_fetch("12.00", "third")
        increase_result = await publish_source_fetch(session, settings, increased.id)
        assert increase_result.changed_prices == 1
        history_count = await session.scalar(select(func.count()).select_from(PlanPriceHistory))
        assert history_count == 2
        history_statuses = list(
            (await session.scalars(select(PlanPriceHistory.review_status))).all()
        )
        assert history_statuses == [ReviewStatus.auto_approved, ReviewStatus.auto_approved]
        plan = await session.scalar(select(ProviderPlan))
        assert plan is not None and str(plan.current_price) == "12.00"
    await engine.dispose()


async def test_missing_plan_requires_repeated_observations(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        scraper_missing_plan_threshold=2,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'missing.db').as_posix()}",
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
            normalized_url_hash="d" * 64,
            source_type=SourceType.pricing,
            country="CA",
        )
        session.add(source)
        await session.flush()
        plan = ProviderPlan(
            provider_id=provider.id,
            source_id=source.id,
            external_key="old",
            name="Old",
            normalized_name="old",
            country="CA",
            currency="CAD",
            billing_cycle="monthly",
            current_price="10.00",
        )
        session.add(plan)
        for index in range(2):
            empty = extract_pricing_catalog(b"Contact sales", default_currency="CAD")
            fetch = SourceFetch(
                source_id=source.id,
                request_id=f"missing-{index}",
                status=SourceFetchStatus.extracted,
                content_hash=f"missing-{index}",
                extracted_data=empty.model_dump(mode="json"),
            )
            session.add(fetch)
            await session.flush()
            await publish_source_fetch(session, settings, fetch.id)
            assert plan.active is (index == 0)
    await engine.dispose()


async def test_publication_reuses_a_provider_plan_seen_on_another_official_source(
    tmp_path: Path,
) -> None:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'provider-wide-plan.db').as_posix()}",
    )
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    async with factory() as session:
        provider = Provider(name="Example", slug="example")
        session.add(provider)
        await session.flush()
        first_source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://example.com/pricing",
            normalized_url_hash="e" * 64,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
        )
        second_source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://example.com/plans",
            normalized_url_hash="f" * 64,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
        )
        session.add_all([first_source, second_source])
        await session.flush()
        catalog = extract_pricing_catalog(
            b'<script type="application/ld+json">'
            b'{"@type":"Offer","name":"Premium","price":"10.00",'
            b'"priceCurrency":"CAD","priceSpecification":"per month"}'
            b"</script>",
            default_currency="CAD",
        )
        for index, source in enumerate((first_source, second_source)):
            fetch = SourceFetch(
                source_id=source.id,
                request_id=f"provider-wide-{index}",
                status=SourceFetchStatus.extracted,
                content_hash=f"provider-wide-{index}",
                extracted_data=catalog.model_dump(mode="json"),
            )
            session.add(fetch)
            await session.flush()
            await publish_source_fetch(session, settings, fetch.id)

        plans = list((await session.scalars(select(ProviderPlan))).all())
        assert len(plans) == 1
        assert plans[0].source_id == first_source.id
    await engine.dispose()


async def test_publication_deduplicates_repeated_deals_in_one_source_fetch(
    tmp_path: Path,
) -> None:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'duplicate-deals.db').as_posix()}",
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
            normalized_url_hash="g" * 64,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
        )
        session.add(source)
        await session.flush()
        repeated_deal = ExtractedDeal(
            title="Save 50% for your first month",
            promotional_price="5.00",
            currency="CAD",
            evidence="Save 50% for your first month",
            confidence=0.9,
        )
        catalog = ExtractedPricingCatalog(
            semantic_hash="duplicate-deal-catalog",
            strategy="test",
            deals=[repeated_deal, repeated_deal],
        )
        fetch = SourceFetch(
            source_id=source.id,
            request_id="duplicate-deals",
            status=SourceFetchStatus.extracted,
            completed_at=datetime.now(UTC),
            content_hash="duplicate-deals",
            extracted_data=catalog.model_dump(mode="json"),
        )
        session.add(fetch)
        await session.flush()

        outcome = await publish_source_fetch(session, settings, fetch.id)

        assert outcome.published_deals == 1
        assert await session.scalar(select(func.count()).select_from(Deal)) == 1
    await engine.dispose()
