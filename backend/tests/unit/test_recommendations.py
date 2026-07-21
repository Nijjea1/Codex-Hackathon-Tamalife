from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import func, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    Deal,
    ItemType,
    PlanAlternative,
    PlanPriceHistory,
    PriceChangeType,
    PriceIntelligenceAlert,
    PricingSource,
    Provider,
    ProviderAlias,
    ProviderPlan,
    ReviewStatus,
    SourceType,
    Subscription,
    User,
    UserPlanMatch,
    UserRecommendation,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.recommendations import (
    generate_user_recommendations,
    match_user_subscriptions,
)


async def test_matching_recommendations_and_outbox_are_user_scoped_and_idempotent(
    tmp_path: Path,
) -> None:
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'recommendations.db').as_posix()}",
    )
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    now = datetime(2026, 7, 20, tzinfo=UTC)
    user_id = uuid4()
    other_user_id = uuid4()

    async with factory() as session:
        session.add_all([User(id=user_id), User(id=other_user_id)])
        provider = Provider(name="Stream Flix", slug="stream-flix")
        other_provider = Provider(name="Value TV", slug="value-tv")
        session.add_all([provider, other_provider])
        await session.flush()
        session.add(
            ProviderAlias(
                provider_id=provider.id,
                alias="StreamFlix",
                normalized_alias="streamflix",
            )
        )
        source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://stream.example/pricing",
            normalized_url_hash="a" * 64,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
        )
        alternative_source = PricingSource(
            provider_id=other_provider.id,
            canonical_url="https://value.example/pricing",
            normalized_url_hash="b" * 64,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
        )
        session.add_all([source, alternative_source])
        await session.flush()
        current_plan = ProviderPlan(
            provider_id=provider.id,
            source_id=source.id,
            external_key="premium",
            name="Premium",
            normalized_name="premium",
            country="CA",
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
            current_price=Decimal("20.00"),
            monthly_equivalent=Decimal("20.00"),
        )
        cheaper_plan = ProviderPlan(
            provider_id=other_provider.id,
            source_id=alternative_source.id,
            external_key="basic",
            name="Basic",
            normalized_name="basic",
            country="CA",
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
            current_price=Decimal("10.00"),
            monthly_equivalent=Decimal("10.00"),
        )
        session.add_all([current_plan, cheaper_plan])
        subscription = Subscription(
            user_id=user_id,
            vendor_name="StreamFlix",
            display_name="Premium",
            item_type=ItemType.subscription,
            category="Entertainment",
            amount=Decimal("20.00"),
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
            creature_name="Nova",
            creature_species="blob",
        )
        other_subscription = Subscription(
            user_id=other_user_id,
            vendor_name="StreamFlix",
            display_name="Premium",
            item_type=ItemType.subscription,
            category="Entertainment",
            amount=Decimal("20.00"),
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
            creature_name="Nova",
            creature_species="blob",
        )
        session.add_all([subscription, other_subscription])
        await session.flush()

        matched = await match_user_subscriptions(session, user_id, now=now)
        assert matched.created == 1
        repeated_match = await match_user_subscriptions(session, user_id, now=now)
        assert repeated_match.created == 0
        assert repeated_match.updated == 1
        match = await session.scalar(select(UserPlanMatch).where(UserPlanMatch.user_id == user_id))
        assert match is not None
        assert match.provider_plan_id == current_plan.id
        assert "provider_exact" in match.reason_codes

        session.add_all(
            [
                PlanPriceHistory(
                    plan_id=current_plan.id,
                    price=Decimal("20.00"),
                    previous_price=Decimal("18.00"),
                    change_amount=Decimal("2.00"),
                    change_percentage=Decimal("11.111"),
                    change_type=PriceChangeType.increase,
                    observed_at=now,
                    confidence=0.96,
                    review_status=ReviewStatus.approved,
                    evidence_hash="c" * 64,
                ),
                Deal(
                    provider_id=provider.id,
                    plan_id=current_plan.id,
                    source_id=source.id,
                    fingerprint="d" * 64,
                    title="Premium loyalty deal",
                    promotional_price=Decimal("15.00"),
                    currency="CAD",
                    country="CA",
                    eligibility={"all_customers": True},
                    expires_at=now + timedelta(days=10),
                    source_url=source.canonical_url,
                    active=True,
                    confidence=0.94,
                    review_status=ReviewStatus.auto_approved,
                ),
                Deal(
                    provider_id=provider.id,
                    plan_id=current_plan.id,
                    source_id=source.id,
                    fingerprint="e" * 64,
                    title="New customers only",
                    promotional_price=Decimal("1.00"),
                    currency="CAD",
                    country="CA",
                    eligibility={"new_customers_only": True},
                    source_url=source.canonical_url,
                    active=True,
                    confidence=0.99,
                    review_status=ReviewStatus.approved,
                ),
                PlanAlternative(
                    source_plan_id=current_plan.id,
                    alternative_plan_id=cheaper_plan.id,
                    country="CA",
                    feature_similarity=0.91,
                    monthly_savings=Decimal("10.00"),
                    annual_savings=Decimal("120.00"),
                    switching_effort=1,
                    reason_codes=["similar_features"],
                    active=True,
                    last_verified_at=now,
                ),
            ]
        )
        await session.flush()

        generated = await generate_user_recommendations(
            session,
            user_id,
            request_id="req-recommendations",
            now=now,
        )
        assert generated.recommendations_created == 3
        assert generated.alerts_created == 3
        repeated = await generate_user_recommendations(
            session,
            user_id,
            request_id="req-recommendations-repeat",
            now=now,
        )
        assert repeated.recommendations_created == 0
        assert repeated.recommendations_updated == 3
        assert repeated.alerts_created == 0

        recommendations = list(
            (
                await session.scalars(
                    select(UserRecommendation).where(UserRecommendation.user_id == user_id)
                )
            ).all()
        )
        assert {item.recommendation_type for item in recommendations} == {
            "price_increase",
            "deal",
            "alternative",
        }
        savings = {
            item.recommendation_type: (
                item.estimated_monthly_savings,
                item.estimated_annual_savings,
            )
            for item in recommendations
        }
        assert savings["price_increase"] == (Decimal("2.00"), Decimal("24.00"))
        assert savings["deal"] == (Decimal("5.00"), Decimal("60.00"))
        assert savings["alternative"] == (Decimal("10.00"), Decimal("120.00"))
        assert (
            await session.scalar(
                select(func.count(PriceIntelligenceAlert.id)).where(
                    PriceIntelligenceAlert.user_id == user_id
                )
            )
            == 3
        )
        assert (
            await session.scalar(
                select(func.count(UserRecommendation.id)).where(
                    UserRecommendation.user_id == other_user_id
                )
            )
            == 0
        )
        await session.commit()
    await engine.dispose()
