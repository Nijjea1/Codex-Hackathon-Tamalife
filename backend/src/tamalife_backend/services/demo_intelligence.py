from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    Deal,
    MatchStatus,
    PlanAlternative,
    PlanPriceHistory,
    PriceChangeType,
    PricingSource,
    Provider,
    ProviderPlan,
    RecommendationStatus,
    ReviewStatus,
    SourceStatus,
    SourceType,
    Subscription,
    SubscriptionStatus,
    UserPlanMatch,
    UserRecommendation,
)


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-") or "subscription"


def _monthly(amount: Decimal, cycle: object) -> Decimal:
    value = str(cycle.value if hasattr(cycle, "value") else cycle)
    if value == "yearly":
        return (amount / Decimal(12)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if value == "weekly":
        return (amount * Decimal(52) / Decimal(12)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    return amount


async def seed_local_demo_intelligence(session: AsyncSession, settings: Settings) -> int:
    """Create clearly simulated local data for a product walkthrough.

    This fixture is deliberately unavailable outside ``local`` and every
    generated title/caption identifies itself as demo data. It exists only so
    the UI can demonstrate price history, deals, and alternatives when public
    provider websites block a hackathon demo environment.
    """
    if settings.environment != "local":
        raise RuntimeError("demo intelligence can only be seeded in the local environment")

    now = datetime.now(UTC)
    subscriptions = list(
        (
            await session.scalars(
                select(Subscription).where(
                    Subscription.archived_at.is_(None),
                    Subscription.status == SubscriptionStatus.active,
                )
            )
        ).all()
    )
    seeded = 0
    for subscription in subscriptions:
        real_match = await session.scalar(
            select(UserPlanMatch.id).where(
                UserPlanMatch.subscription_id == subscription.id,
                UserPlanMatch.status == MatchStatus.confirmed,
                UserPlanMatch.method != "demo_fixture",
            )
        )
        if real_match is not None:
            continue

        slug = f"demo-{_slug(subscription.vendor_name)}"
        provider = await session.scalar(select(Provider).where(Provider.slug == slug))
        if provider is None:
            provider = Provider(
                name=f"Sample {subscription.vendor_name}",
                slug=slug,
                category=subscription.category,
                policy_status="demo_fixture",
            )
            session.add(provider)
            await session.flush()
        else:
            provider.name = f"Sample {subscription.vendor_name}"
        source_url = f"https://demo.tamalife.local/pricing/{slug}"
        source = await session.scalar(
            select(PricingSource).where(PricingSource.canonical_url == source_url)
        )
        if source is None:
            source = PricingSource(
                provider_id=provider.id,
                canonical_url=source_url,
                normalized_url_hash=hashlib.sha256(source_url.encode()).hexdigest(),
                source_type=SourceType.pricing,
                country="CA",
                currency=subscription.currency,
                status=SourceStatus.active,
                last_success_at=now,
            )
            session.add(source)
            await session.flush()

        external_key = f"demo-recorded-{subscription.id}"
        plan = await session.scalar(
            select(ProviderPlan).where(
                ProviderPlan.provider_id == provider.id,
                ProviderPlan.external_key == external_key,
                ProviderPlan.country == "CA",
                ProviderPlan.currency == subscription.currency,
                ProviderPlan.billing_cycle == subscription.billing_cycle,
            )
        )
        if plan is None:
            plan = ProviderPlan(
                provider_id=provider.id,
                source_id=source.id,
                external_key=external_key,
                name=f"{subscription.display_name} — sample tracked plan",
                normalized_name=f"sample {subscription.display_name.lower()}",
                country="CA",
                currency=subscription.currency,
                billing_cycle=subscription.billing_cycle,
                current_price=subscription.amount,
                monthly_equivalent=_monthly(subscription.amount, subscription.billing_cycle),
                confidence=1.0,
                first_observed_at=now,
                last_observed_at=now,
            )
            session.add(plan)
            await session.flush()
        else:
            plan.name = f"{subscription.display_name} — sample tracked plan"
            plan.normalized_name = f"sample {subscription.display_name.lower()}"
            plan.current_price = subscription.amount
            plan.monthly_equivalent = _monthly(subscription.amount, subscription.billing_cycle)
            plan.active = True
            plan.last_observed_at = now

        match = await session.scalar(
            select(UserPlanMatch).where(
                UserPlanMatch.subscription_id == subscription.id,
                UserPlanMatch.provider_plan_id == plan.id,
            )
        )
        if match is None:
            session.add(
                UserPlanMatch(
                    user_id=subscription.user_id,
                    subscription_id=subscription.id,
                    provider_id=provider.id,
                    provider_plan_id=plan.id,
                    confidence=1.0,
                    method="demo_fixture",
                    reason_codes=["local_demo"],
                    status=MatchStatus.confirmed,
                    confirmed_at=now,
                )
            )
        else:
            match.method = "sample_fixture"
            match.reason_codes = ["local_sample"]
            match.status = MatchStatus.confirmed
            match.confirmed_at = now

        evidence_hash = hashlib.sha256(
            f"demo:{subscription.id}:{subscription.amount}".encode()
        ).hexdigest()
        history = await session.scalar(
            select(PlanPriceHistory).where(
                PlanPriceHistory.plan_id == plan.id,
                PlanPriceHistory.evidence_hash == evidence_hash,
            )
        )
        if history is None:
            session.add(
                PlanPriceHistory(
                    plan_id=plan.id,
                    price=subscription.amount,
                    change_type=PriceChangeType.initial,
                    observed_at=now,
                    confidence=1.0,
                    review_status=ReviewStatus.auto_approved,
                    evidence_hash=evidence_hash,
                )
            )

        # Spotify intentionally receives no offer or cheaper tier, so the
        # product can demonstrate the successful "no better deal found" state.
        has_demo_offer = "spotify" not in subscription.vendor_name.casefold()
        if has_demo_offer:
            discounted = (subscription.amount * Decimal("0.80")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            deal_fingerprint = hashlib.sha256(f"demo-deal:{subscription.id}".encode()).hexdigest()
            deal = await session.scalar(
                select(Deal).where(
                    Deal.provider_id == provider.id,
                    Deal.source_id == source.id,
                    Deal.fingerprint == deal_fingerprint,
                )
            )
            if deal is None:
                deal = Deal(
                    provider_id=provider.id,
                    plan_id=plan.id,
                    source_id=source.id,
                    fingerprint=deal_fingerprint,
                    title="Sample: 20% annual-plan offer",
                    description="Simulated local walkthrough data — not a real provider offer.",
                    regular_price=subscription.amount,
                    promotional_price=discounted,
                    currency=subscription.currency,
                    country="CA",
                    eligibility={"demo_fixture": True},
                    source_url=source_url,
                    active=True,
                    confidence=1.0,
                    review_status=ReviewStatus.auto_approved,
                )
                session.add(deal)
            else:
                deal.title = "Sample: 20% annual-plan offer"
                deal.description = "Simulated local walkthrough data — not a real provider offer."

            alternative_key = f"demo-save-{subscription.id}"
            alternative_plan = await session.scalar(
                select(ProviderPlan).where(
                    ProviderPlan.provider_id == provider.id,
                    ProviderPlan.external_key == alternative_key,
                    ProviderPlan.country == "CA",
                    ProviderPlan.currency == subscription.currency,
                    ProviderPlan.billing_cycle == subscription.billing_cycle,
                )
            )
            if alternative_plan is None:
                alternative_plan = ProviderPlan(
                    provider_id=provider.id,
                    source_id=source.id,
                    external_key=alternative_key,
                    name="Sample Saver plan",
                    normalized_name="sample saver plan",
                    country="CA",
                    currency=subscription.currency,
                    billing_cycle=subscription.billing_cycle,
                    current_price=discounted,
                    monthly_equivalent=_monthly(discounted, subscription.billing_cycle),
                    confidence=1.0,
                    first_observed_at=now,
                    last_observed_at=now,
                )
                session.add(alternative_plan)
                await session.flush()
            alternative = await session.scalar(
                select(PlanAlternative).where(
                    PlanAlternative.source_plan_id == plan.id,
                    PlanAlternative.alternative_plan_id == alternative_plan.id,
                    PlanAlternative.country == "CA",
                )
            )
            monthly_savings = _monthly(subscription.amount, subscription.billing_cycle) - _monthly(
                discounted, subscription.billing_cycle
            )
            if alternative is None:
                session.add(
                    PlanAlternative(
                        source_plan_id=plan.id,
                        alternative_plan_id=alternative_plan.id,
                        country="CA",
                        feature_similarity=0.9,
                        monthly_savings=monthly_savings,
                        annual_savings=monthly_savings * Decimal(12),
                        switching_effort=1,
                        reason_codes=["local_demo"],
                        last_verified_at=now,
                    )
                )
            recommendation = await session.scalar(
                select(UserRecommendation).where(
                    UserRecommendation.user_id == subscription.user_id,
                    UserRecommendation.subscription_id == subscription.id,
                    UserRecommendation.deduplication_key == "demo-local-offer",
                )
            )
            if recommendation is None:
                session.add(
                    UserRecommendation(
                        user_id=subscription.user_id,
                        subscription_id=subscription.id,
                        recommendation_type="demo_switch_plan",
                        target_plan_id=alternative_plan.id,
                        deal_id=deal.id,
                        deduplication_key="demo-local-offer",
                        estimated_monthly_savings=monthly_savings,
                        estimated_annual_savings=monthly_savings * Decimal(12),
                        reason_codes=["local_demo"],
                        explanation=(
                            "Demo recommendation: simulated savings preview for the "
                            "hackathon walkthrough."
                        ),
                        confidence=1.0,
                        generator_version="local-demo-v1",
                        status=RecommendationStatus.active,
                        expires_at=now + timedelta(days=30),
                    )
                )
            else:
                recommendation.recommendation_type = "sample_switch_plan"
                recommendation.explanation = (
                    "Sample recommendation: simulated savings preview for the "
                    "hackathon walkthrough."
                )
                recommendation.reason_codes = ["local_sample"]
        seeded += 1
    await session.flush()
    return seeded
