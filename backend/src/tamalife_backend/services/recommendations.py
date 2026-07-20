from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.db.models import (
    AlertDeliveryStatus,
    Deal,
    MatchStatus,
    PlanAlternative,
    PlanPriceHistory,
    PriceChangeType,
    PriceIntelligenceAlert,
    Provider,
    ProviderAlias,
    ProviderPlan,
    RecommendationStatus,
    ReviewStatus,
    Subscription,
    SubscriptionStatus,
    UserPlanMatch,
    UserRecommendation,
)
from tamalife_backend.domain.price_intelligence import (
    NormalizedCost,
    deal_is_conservatively_eligible,
    normalized_cost,
    positive_savings,
    score_subscription_plan,
)

GENERATOR_VERSION = "deterministic-price-intelligence-v1"
MIN_MATCH_CONFIDENCE = 0.55
CONFIRMED_MATCH_CONFIDENCE = 0.90
PUBLISHABLE_REVIEWS = {ReviewStatus.approved, ReviewStatus.auto_approved}


@dataclass(frozen=True)
class MatchGenerationOutcome:
    user_id: UUID
    created: int
    updated: int
    unmatched: int


@dataclass(frozen=True)
class RecommendationGenerationOutcome:
    user_id: UUID
    recommendations_created: int
    recommendations_updated: int
    alerts_created: int


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


async def match_user_subscriptions(
    session: AsyncSession,
    user_id: UUID,
    *,
    now: datetime | None = None,
) -> MatchGenerationOutcome:
    reference = now or datetime.now(UTC)
    subscriptions = list(
        (
            await session.scalars(
                select(Subscription).where(
                    Subscription.user_id == user_id,
                    Subscription.archived_at.is_(None),
                    Subscription.status == SubscriptionStatus.active,
                )
            )
        ).all()
    )
    providers = {
        provider.id: provider
        for provider in (
            await session.scalars(select(Provider).where(Provider.active.is_(True)))
        ).all()
    }
    aliases: dict[UUID, list[str]] = {}
    for alias in (await session.scalars(select(ProviderAlias))).all():
        aliases.setdefault(alias.provider_id, []).extend([alias.alias, alias.normalized_alias])
    plans = list(
        (await session.scalars(select(ProviderPlan).where(ProviderPlan.active.is_(True)))).all()
    )
    created = updated = unmatched = 0
    for subscription in subscriptions:
        confirmed = await session.scalar(
            select(UserPlanMatch.id).where(
                UserPlanMatch.user_id == user_id,
                UserPlanMatch.subscription_id == subscription.id,
                UserPlanMatch.status == MatchStatus.confirmed,
            )
        )
        if confirmed is not None:
            continue
        best: tuple[float, str, ProviderPlan, tuple[str, ...]] | None = None
        for plan in plans:
            provider = providers.get(plan.provider_id)
            if provider is None:
                continue
            score = score_subscription_plan(
                vendor_name=subscription.vendor_name,
                display_name=subscription.display_name,
                amount=subscription.amount,
                currency=subscription.currency,
                billing_cycle=subscription.billing_cycle,
                provider_names=(
                    provider.name,
                    provider.slug,
                    *aliases.get(provider.id, []),
                ),
                plan_name=plan.name,
                plan_price=plan.current_price,
                plan_currency=plan.currency,
                plan_billing_cycle=plan.billing_cycle,
            )
            candidate = (score.confidence, plan.external_key, plan, score.reason_codes)
            if best is None or (candidate[0], candidate[1]) > (best[0], best[1]):
                best = candidate
        if best is None or best[0] < MIN_MATCH_CONFIDENCE:
            unmatched += 1
            continue
        confidence, _, plan, reason_codes = best
        match = await session.scalar(
            select(UserPlanMatch).where(
                UserPlanMatch.user_id == user_id,
                UserPlanMatch.subscription_id == subscription.id,
                UserPlanMatch.provider_plan_id == plan.id,
            )
        )
        status = (
            MatchStatus.confirmed
            if confidence >= CONFIRMED_MATCH_CONFIDENCE
            else MatchStatus.pending
        )
        if match is None:
            match = UserPlanMatch(
                user_id=user_id,
                subscription_id=subscription.id,
                provider_id=plan.provider_id,
                provider_plan_id=plan.id,
                confidence=confidence,
                method="deterministic_v1",
                reason_codes=list(reason_codes),
                status=status,
                confirmed_at=reference if status is MatchStatus.confirmed else None,
            )
            session.add(match)
            created += 1
        else:
            match.confidence = confidence
            match.method = "deterministic_v1"
            match.reason_codes = list(reason_codes)
            if match.status not in {MatchStatus.rejected, MatchStatus.confirmed}:
                match.status = status
            if match.status is MatchStatus.confirmed and match.confirmed_at is None:
                match.confirmed_at = reference
            updated += 1
        stale_matches = list(
            (
                await session.scalars(
                    select(UserPlanMatch).where(
                        UserPlanMatch.user_id == user_id,
                        UserPlanMatch.subscription_id == subscription.id,
                        UserPlanMatch.provider_plan_id != plan.id,
                        UserPlanMatch.status == MatchStatus.pending,
                    )
                )
            ).all()
        )
        for stale in stale_matches:
            stale.status = MatchStatus.unmatched
    await session.flush()
    return MatchGenerationOutcome(user_id, created, updated, unmatched)


async def _upsert_recommendation(
    session: AsyncSession,
    *,
    user_id: UUID,
    subscription: Subscription,
    recommendation_type: str,
    deduplication_key: str,
    savings: NormalizedCost,
    reason_codes: list[str],
    explanation: str,
    confidence: float,
    expires_at: datetime,
    request_id: str,
    target_plan_id: UUID | None = None,
    deal_id: UUID | None = None,
    price_history_id: UUID | None = None,
) -> tuple[bool, bool, bool]:
    recommendation = await session.scalar(
        select(UserRecommendation).where(
            UserRecommendation.user_id == user_id,
            UserRecommendation.subscription_id == subscription.id,
            UserRecommendation.deduplication_key == deduplication_key,
        )
    )
    created = recommendation is None
    if recommendation is None:
        recommendation = UserRecommendation(
            user_id=user_id,
            subscription_id=subscription.id,
            recommendation_type=recommendation_type,
            target_plan_id=target_plan_id,
            deal_id=deal_id,
            deduplication_key=deduplication_key,
            estimated_monthly_savings=savings.monthly,
            estimated_annual_savings=savings.annual,
            reason_codes=reason_codes,
            explanation=explanation,
            confidence=confidence,
            generator_version=GENERATOR_VERSION,
            status=RecommendationStatus.active,
            expires_at=expires_at,
        )
        session.add(recommendation)
        await session.flush()
    elif recommendation.status in {RecommendationStatus.active, RecommendationStatus.seen}:
        recommendation.target_plan_id = target_plan_id
        recommendation.deal_id = deal_id
        recommendation.estimated_monthly_savings = savings.monthly
        recommendation.estimated_annual_savings = savings.annual
        recommendation.reason_codes = reason_codes
        recommendation.explanation = explanation
        recommendation.confidence = confidence
        recommendation.generator_version = GENERATOR_VERSION
        recommendation.expires_at = expires_at

    alert_created = False
    if created:
        alert_key = f"recommendation:{recommendation.id}"
        existing_alert = await session.scalar(
            select(PriceIntelligenceAlert.id).where(
                PriceIntelligenceAlert.user_id == user_id,
                PriceIntelligenceAlert.deduplication_key == alert_key,
            )
        )
        if existing_alert is None:
            session.add(
                PriceIntelligenceAlert(
                    user_id=user_id,
                    subscription_id=subscription.id,
                    recommendation_id=recommendation.id,
                    price_history_id=price_history_id,
                    deal_id=deal_id,
                    alert_type=recommendation_type,
                    deduplication_key=alert_key,
                    status=AlertDeliveryStatus.pending,
                    request_id=request_id[:100],
                )
            )
            alert_created = True
    return created, not created, alert_created


async def generate_user_recommendations(
    session: AsyncSession,
    user_id: UUID,
    *,
    request_id: str,
    now: datetime | None = None,
) -> RecommendationGenerationOutcome:
    reference = now or datetime.now(UTC)
    matches = list(
        (
            await session.scalars(
                select(UserPlanMatch).where(
                    UserPlanMatch.user_id == user_id,
                    UserPlanMatch.status.in_([MatchStatus.pending, MatchStatus.confirmed]),
                    UserPlanMatch.confidence >= MIN_MATCH_CONFIDENCE,
                )
            )
        ).all()
    )
    created_count = updated_count = alert_count = 0
    for match in matches:
        subscription = await session.scalar(
            select(Subscription).where(
                Subscription.id == match.subscription_id,
                Subscription.user_id == user_id,
                Subscription.archived_at.is_(None),
                Subscription.status == SubscriptionStatus.active,
            )
        )
        if subscription is None:
            continue
        matched_plan = await session.get(ProviderPlan, match.provider_plan_id)
        if matched_plan is None or not matched_plan.active:
            continue

        histories = list(
            (
                await session.scalars(
                    select(PlanPriceHistory).where(
                        PlanPriceHistory.plan_id == matched_plan.id,
                        PlanPriceHistory.review_status.in_(PUBLISHABLE_REVIEWS),
                        PlanPriceHistory.change_type == PriceChangeType.increase,
                    )
                )
            ).all()
        )
        for history in histories:
            if history.change_amount is None or history.change_amount <= 0:
                continue
            savings = normalized_cost(history.change_amount, matched_plan.billing_cycle)
            result = await _upsert_recommendation(
                session,
                user_id=user_id,
                subscription=subscription,
                recommendation_type="price_increase",
                deduplication_key=f"price:{history.id}",
                savings=savings,
                reason_codes=["approved_price_increase"],
                explanation=f"{matched_plan.name} increased by {history.change_amount}.",
                confidence=min(match.confidence, history.confidence),
                expires_at=reference + timedelta(days=30),
                request_id=request_id,
                target_plan_id=matched_plan.id,
                price_history_id=history.id,
            )
            created_count += int(result[0])
            updated_count += int(result[1])
            alert_count += int(result[2])

        deals = list(
            (
                await session.scalars(
                    select(Deal).where(
                        Deal.provider_id == matched_plan.provider_id,
                        Deal.active.is_(True),
                        Deal.review_status.in_(PUBLISHABLE_REVIEWS),
                    )
                )
            ).all()
        )
        current_cost = normalized_cost(subscription.amount, subscription.billing_cycle)
        for deal in deals:
            if deal.plan_id is not None and deal.plan_id != matched_plan.id:
                continue
            if (
                deal.promotional_price is None
                or not deal_is_conservatively_eligible(deal.eligibility)
                or (deal.currency is not None and deal.currency != subscription.currency)
                or (deal.expires_at is not None and _as_utc(deal.expires_at) <= _as_utc(reference))
            ):
                continue
            deal_cost = normalized_cost(deal.promotional_price, matched_plan.billing_cycle)
            savings = positive_savings(current_cost, deal_cost)
            if savings.monthly <= 0 and savings.annual <= 0:
                continue
            result = await _upsert_recommendation(
                session,
                user_id=user_id,
                subscription=subscription,
                recommendation_type="deal",
                deduplication_key=f"deal:{deal.id}",
                savings=savings,
                reason_codes=["approved_active_deal"],
                explanation=deal.title,
                confidence=min(match.confidence, deal.confidence),
                expires_at=deal.expires_at or reference + timedelta(days=30),
                request_id=request_id,
                target_plan_id=matched_plan.id,
                deal_id=deal.id,
            )
            created_count += int(result[0])
            updated_count += int(result[1])
            alert_count += int(result[2])

        alternatives = list(
            (
                await session.scalars(
                    select(PlanAlternative).where(
                        PlanAlternative.source_plan_id == matched_plan.id,
                        PlanAlternative.active.is_(True),
                    )
                )
            ).all()
        )
        for alternative in alternatives:
            target = await session.get(ProviderPlan, alternative.alternative_plan_id)
            if target is None or not target.active or target.currency != subscription.currency:
                continue
            target_cost = normalized_cost(target.current_price, target.billing_cycle)
            savings = positive_savings(current_cost, target_cost)
            if savings.monthly <= 0 and savings.annual <= 0:
                continue
            result = await _upsert_recommendation(
                session,
                user_id=user_id,
                subscription=subscription,
                recommendation_type="alternative",
                deduplication_key=f"alternative:{alternative.id}",
                savings=savings,
                reason_codes=["cheaper_verified_alternative", *alternative.reason_codes],
                explanation=f"Switch to {target.name} for a lower normalized cost.",
                confidence=min(match.confidence, alternative.feature_similarity),
                expires_at=reference + timedelta(days=30),
                request_id=request_id,
                target_plan_id=target.id,
            )
            created_count += int(result[0])
            updated_count += int(result[1])
            alert_count += int(result[2])
    await session.flush()
    return RecommendationGenerationOutcome(
        user_id,
        created_count,
        updated_count,
        alert_count,
    )
