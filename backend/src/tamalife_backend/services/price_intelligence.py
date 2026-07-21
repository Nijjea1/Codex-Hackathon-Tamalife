from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
    Subscription,
    User,
    UserPlanMatch,
    UserRecommendation,
)
from tamalife_backend.errors import ApiError
from tamalife_backend.price_intelligence_schemas import (
    AlternativeItem,
    AlternativesResponse,
    DashboardSubscriptionItem,
    DealItem,
    DealsResponse,
    MatchConfirmationRequest,
    MatchConfirmationResponse,
    MerchantMatch,
    PriceHistoryResponse,
    PriceIntelligenceDashboard,
    PriceIntelligenceSummary,
    PricePoint,
    RecommendationFeedbackRequest,
    RecommendationItem,
    SourceMetadata,
    SubscriptionIntelligenceResponse,
)

PUBLISHED_REVIEWS = (ReviewStatus.approved, ReviewStatus.auto_approved)


def _money(value: Decimal | None) -> str | None:
    return format(value, "f") if value is not None else None


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


async def _owned_subscription(
    session: AsyncSession, user: User, subscription_id: UUID
) -> Subscription:
    subscription = await session.scalar(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.user_id == user.id,
            Subscription.archived_at.is_(None),
        )
    )
    if subscription is None:
        raise ApiError("subscription_not_found", "Subscription was not found", 404)
    return subscription


def _source_metadata(source: PricingSource, confidence: float) -> SourceMetadata:
    return SourceMetadata(
        source_id=source.id,
        source_url=source.canonical_url,
        checked_at=source.last_success_at or source.last_checked_at,
        confidence=confidence,
    )


def _match_dto(match: UserPlanMatch, plan: ProviderPlan, provider: Provider) -> MerchantMatch:
    return MerchantMatch(
        id=match.id,
        provider_id=provider.id,
        provider_plan_id=plan.id,
        provider_name=provider.name,
        plan_name=plan.name,
        status=match.status,
        confidence=match.confidence,
        method=match.method,
        reason_codes=match.reason_codes,
        updated_at=match.updated_at,
    )


def _price_dto(history: PlanPriceHistory, source: PricingSource, plan: ProviderPlan) -> PricePoint:
    return PricePoint(
        id=history.id,
        price=_money(history.price) or "0",
        promotional_price=_money(history.promotional_price),
        previous_price=_money(history.previous_price),
        change_amount=_money(history.change_amount),
        change_percentage=_money(history.change_percentage),
        change_type=history.change_type,
        observed_at=history.observed_at,
        confidence=history.confidence,
        source=_source_metadata(source, min(history.confidence, plan.confidence)),
    )


def _recommendation_dto(item: UserRecommendation) -> RecommendationItem:
    return RecommendationItem(
        id=item.id,
        subscription_id=item.subscription_id,
        recommendation_type=item.recommendation_type,
        target_plan_id=item.target_plan_id,
        deal_id=item.deal_id,
        estimated_monthly_savings=_money(item.estimated_monthly_savings),
        estimated_annual_savings=_money(item.estimated_annual_savings),
        reason_codes=item.reason_codes,
        explanation=item.explanation,
        confidence=item.confidence,
        status=item.status,
        expires_at=item.expires_at,
        feedback=item.feedback,
        feedback_reason=item.feedback_reason,
        updated_at=item.updated_at,
    )


async def _current_match(
    session: AsyncSession, user_id: UUID, subscription_id: UUID
) -> tuple[UserPlanMatch, ProviderPlan, Provider] | None:
    row = (
        await session.execute(
            select(UserPlanMatch, ProviderPlan, Provider)
            .join(ProviderPlan, ProviderPlan.id == UserPlanMatch.provider_plan_id)
            .join(Provider, Provider.id == ProviderPlan.provider_id)
            .where(
                UserPlanMatch.user_id == user_id,
                UserPlanMatch.subscription_id == subscription_id,
                UserPlanMatch.status.in_((MatchStatus.confirmed, MatchStatus.pending)),
                ProviderPlan.active.is_(True),
            )
            .order_by(
                (UserPlanMatch.status == MatchStatus.confirmed).desc(),
                UserPlanMatch.updated_at.desc(),
            )
            .limit(1)
        )
    ).one_or_none()
    return (row[0], row[1], row[2]) if row is not None else None


async def price_history(
    session: AsyncSession, user: User, subscription_id: UUID
) -> PriceHistoryResponse:
    await _owned_subscription(session, user, subscription_id)
    match = await _current_match(session, user.id, subscription_id)
    if match is None or match[0].status is not MatchStatus.confirmed:
        return PriceHistoryResponse(subscription_id=subscription_id, items=[])
    rows = (
        await session.execute(
            select(PlanPriceHistory, PricingSource, ProviderPlan)
            .join(ProviderPlan, ProviderPlan.id == PlanPriceHistory.plan_id)
            .join(PricingSource, PricingSource.id == ProviderPlan.source_id)
            .where(
                PlanPriceHistory.plan_id == match[1].id,
                PlanPriceHistory.review_status.in_(PUBLISHED_REVIEWS),
            )
            .order_by(PlanPriceHistory.observed_at.desc(), PlanPriceHistory.id.desc())
            .limit(100)
        )
    ).all()
    return PriceHistoryResponse(
        subscription_id=subscription_id,
        items=[_price_dto(history, source, plan) for history, source, plan in rows],
    )


async def deals(session: AsyncSession, user: User, subscription_id: UUID) -> DealsResponse:
    await _owned_subscription(session, user, subscription_id)
    match = await _current_match(session, user.id, subscription_id)
    if match is None or match[0].status is not MatchStatus.confirmed:
        return DealsResponse(subscription_id=subscription_id, items=[])
    now = datetime.now(UTC)
    rows = (
        await session.execute(
            select(Deal, PricingSource)
            .join(PricingSource, PricingSource.id == Deal.source_id)
            .where(
                Deal.provider_id == match[2].id,
                or_(Deal.plan_id.is_(None), Deal.plan_id == match[1].id),
                Deal.active.is_(True),
                Deal.review_status.in_(PUBLISHED_REVIEWS),
                or_(Deal.starts_at.is_(None), Deal.starts_at <= now),
                or_(Deal.expires_at.is_(None), Deal.expires_at > now),
            )
            .order_by(Deal.confidence.desc(), Deal.id)
            .limit(100)
        )
    ).all()
    return DealsResponse(
        subscription_id=subscription_id,
        items=[
            DealItem(
                id=item.id,
                title=item.title,
                description=item.description,
                regular_price=_money(item.regular_price),
                promotional_price=_money(item.promotional_price),
                currency=item.currency,
                country=item.country,
                eligibility=item.eligibility,
                starts_at=item.starts_at,
                expires_at=item.expires_at,
                confidence=item.confidence,
                source=_source_metadata(source, item.confidence),
            )
            for item, source in rows
        ],
    )


async def alternatives(
    session: AsyncSession, user: User, subscription_id: UUID
) -> AlternativesResponse:
    await _owned_subscription(session, user, subscription_id)
    match = await _current_match(session, user.id, subscription_id)
    if match is None or match[0].status is not MatchStatus.confirmed:
        return AlternativesResponse(subscription_id=subscription_id, items=[])
    rows = (
        await session.execute(
            select(PlanAlternative, ProviderPlan, Provider)
            .join(ProviderPlan, ProviderPlan.id == PlanAlternative.alternative_plan_id)
            .join(Provider, Provider.id == ProviderPlan.provider_id)
            .where(
                PlanAlternative.source_plan_id == match[1].id,
                PlanAlternative.active.is_(True),
                ProviderPlan.active.is_(True),
            )
            .order_by(PlanAlternative.monthly_savings.desc(), PlanAlternative.id)
            .limit(100)
        )
    ).all()
    return AlternativesResponse(
        subscription_id=subscription_id,
        items=[
            AlternativeItem(
                id=item.id,
                provider_plan_id=plan.id,
                provider_name=provider.name,
                plan_name=plan.name,
                billing_cycle=plan.billing_cycle,
                current_price=_money(plan.current_price) or "0",
                monthly_cost=_money(plan.monthly_equivalent),
                monthly_savings=_money(item.monthly_savings),
                annual_savings=_money(item.annual_savings),
                feature_similarity=item.feature_similarity,
                switching_effort=item.switching_effort,
                reason_codes=item.reason_codes,
                confidence=min(item.feature_similarity, plan.confidence),
                fresh_at=item.last_verified_at,
            )
            for item, plan, provider in rows
        ],
    )


async def subscription_intelligence(
    session: AsyncSession, user: User, subscription_id: UUID
) -> SubscriptionIntelligenceResponse:
    await _owned_subscription(session, user, subscription_id)
    current = await _current_match(session, user.id, subscription_id)
    history = await price_history(session, user, subscription_id)
    now = datetime.now(UTC)
    recommendations = list(
        (
            await session.scalars(
                select(UserRecommendation)
                .where(
                    UserRecommendation.user_id == user.id,
                    UserRecommendation.subscription_id == subscription_id,
                    UserRecommendation.status.in_(
                        (RecommendationStatus.active, RecommendationStatus.seen)
                    ),
                    or_(
                        UserRecommendation.expires_at.is_(None),
                        UserRecommendation.expires_at > now,
                    ),
                )
                .order_by(UserRecommendation.confidence.desc(), UserRecommendation.id)
            )
        ).all()
    )
    return SubscriptionIntelligenceResponse(
        subscription_id=subscription_id,
        match=_match_dto(*current) if current else None,
        latest_price=history.items[0] if history.items else None,
        recommendations=[_recommendation_dto(item) for item in recommendations],
        generated_at=now,
    )


async def summary(session: AsyncSession, user: User) -> PriceIntelligenceSummary:
    subscriptions = list(
        (
            await session.scalars(
                select(Subscription).where(
                    Subscription.user_id == user.id, Subscription.archived_at.is_(None)
                )
            )
        ).all()
    )
    subscription_ids = [item.id for item in subscriptions]
    now = datetime.now(UTC)
    if not subscription_ids:
        return PriceIntelligenceSummary(
            subscription_count=0,
            matched_count=0,
            unmatched_count=0,
            price_change_count=0,
            active_deal_count=0,
            recommendation_count=0,
            estimated_monthly_savings="0",
            estimated_annual_savings="0",
            generated_at=now,
        )
    confirmed_plan_ids = select(UserPlanMatch.provider_plan_id).where(
        UserPlanMatch.user_id == user.id,
        UserPlanMatch.subscription_id.in_(subscription_ids),
        UserPlanMatch.status == MatchStatus.confirmed,
    )
    matched = int(
        await session.scalar(
            select(func.count(func.distinct(UserPlanMatch.subscription_id))).where(
                UserPlanMatch.user_id == user.id,
                UserPlanMatch.subscription_id.in_(subscription_ids),
                UserPlanMatch.status == MatchStatus.confirmed,
            )
        )
        or 0
    )
    price_changes = int(
        await session.scalar(
            select(func.count(PlanPriceHistory.id)).where(
                PlanPriceHistory.plan_id.in_(confirmed_plan_ids),
                PlanPriceHistory.review_status.in_(PUBLISHED_REVIEWS),
                PlanPriceHistory.change_type != PriceChangeType.unchanged,
            )
        )
        or 0
    )
    provider_ids = select(UserPlanMatch.provider_id).where(
        UserPlanMatch.user_id == user.id,
        UserPlanMatch.subscription_id.in_(subscription_ids),
        UserPlanMatch.status == MatchStatus.confirmed,
    )
    deal_count = int(
        await session.scalar(
            select(func.count(Deal.id)).where(
                Deal.provider_id.in_(provider_ids),
                Deal.active.is_(True),
                Deal.review_status.in_(PUBLISHED_REVIEWS),
                or_(Deal.expires_at.is_(None), Deal.expires_at > now),
            )
        )
        or 0
    )
    recommendation_query = select(UserRecommendation).where(
        UserRecommendation.user_id == user.id,
        UserRecommendation.subscription_id.in_(subscription_ids),
        UserRecommendation.status.in_((RecommendationStatus.active, RecommendationStatus.seen)),
        or_(UserRecommendation.expires_at.is_(None), UserRecommendation.expires_at > now),
    )
    recommendations = list((await session.scalars(recommendation_query)).all())
    monthly = sum(
        (item.estimated_monthly_savings or Decimal(0) for item in recommendations), Decimal(0)
    )
    annual = sum(
        (item.estimated_annual_savings or Decimal(0) for item in recommendations), Decimal(0)
    )
    return PriceIntelligenceSummary(
        subscription_count=len(subscriptions),
        matched_count=matched,
        unmatched_count=len(subscriptions) - matched,
        price_change_count=price_changes,
        active_deal_count=deal_count,
        recommendation_count=len(recommendations),
        estimated_monthly_savings=_money(monthly) or "0",
        estimated_annual_savings=_money(annual) or "0",
        generated_at=now,
    )


async def dashboard(session: AsyncSession, user: User) -> PriceIntelligenceDashboard:
    """Return the Insights payload in a bounded set of batched queries.

    This deliberately avoids making the mobile client issue a request per
    subscription and gives every card the same freshness timestamp.
    """
    generated_at = datetime.now(UTC)
    subscriptions = list(
        (
            await session.scalars(
                select(Subscription)
                .where(Subscription.user_id == user.id, Subscription.archived_at.is_(None))
                .order_by(Subscription.renewal_or_expiry_date, Subscription.id)
            )
        ).all()
    )
    if not subscriptions:
        return PriceIntelligenceDashboard(
            summary=await summary(session, user), subscriptions=[], generated_at=generated_at
        )

    subscription_ids = [subscription.id for subscription in subscriptions]
    match_rows = (
        await session.execute(
            select(UserPlanMatch, ProviderPlan, Provider)
            .join(ProviderPlan, ProviderPlan.id == UserPlanMatch.provider_plan_id)
            .join(Provider, Provider.id == ProviderPlan.provider_id)
            .where(
                UserPlanMatch.user_id == user.id,
                UserPlanMatch.subscription_id.in_(subscription_ids),
                UserPlanMatch.status.in_((MatchStatus.confirmed, MatchStatus.pending)),
                ProviderPlan.active.is_(True),
            )
            .order_by(
                UserPlanMatch.subscription_id,
                (UserPlanMatch.status == MatchStatus.confirmed).desc(),
                UserPlanMatch.updated_at.desc(),
            )
        )
    ).all()
    matches: dict[UUID, tuple[UserPlanMatch, ProviderPlan, Provider]] = {}
    for match, plan, provider in match_rows:
        matches.setdefault(match.subscription_id, (match, plan, provider))

    confirmed_plan_ids = [
        plan.id
        for match, plan, _provider in matches.values()
        if match.status is MatchStatus.confirmed
    ]
    latest_prices: dict[UUID, PricePoint] = {}
    if confirmed_plan_ids:
        history_rows = (
            await session.execute(
                select(PlanPriceHistory, PricingSource, ProviderPlan)
                .join(ProviderPlan, ProviderPlan.id == PlanPriceHistory.plan_id)
                .join(PricingSource, PricingSource.id == ProviderPlan.source_id)
                .where(
                    PlanPriceHistory.plan_id.in_(confirmed_plan_ids),
                    PlanPriceHistory.review_status.in_(PUBLISHED_REVIEWS),
                )
                .order_by(
                    PlanPriceHistory.plan_id,
                    PlanPriceHistory.observed_at.desc(),
                    PlanPriceHistory.id.desc(),
                )
            )
        ).all()
        for history, source, plan in history_rows:
            latest_prices.setdefault(plan.id, _price_dto(history, source, plan))

    recommendations_by_subscription: dict[UUID, list[RecommendationItem]] = {
        subscription_id: [] for subscription_id in subscription_ids
    }
    recommendations = list(
        (
            await session.scalars(
                select(UserRecommendation)
                .where(
                    UserRecommendation.user_id == user.id,
                    UserRecommendation.subscription_id.in_(subscription_ids),
                    UserRecommendation.status.in_(
                        (RecommendationStatus.active, RecommendationStatus.seen)
                    ),
                    or_(
                        UserRecommendation.expires_at.is_(None),
                        UserRecommendation.expires_at > generated_at,
                    ),
                )
                .order_by(UserRecommendation.subscription_id, UserRecommendation.confidence.desc())
            )
        ).all()
    )
    for recommendation in recommendations:
        recommendations_by_subscription[recommendation.subscription_id].append(
            _recommendation_dto(recommendation)
        )

    deal_counts: dict[UUID, int] = {}
    provider_ids = {provider.id for _match, _plan, provider in matches.values()}
    if provider_ids:
        deal_rows = (
            await session.execute(
                select(Deal.provider_id, func.count(Deal.id))
                .where(
                    Deal.provider_id.in_(provider_ids),
                    Deal.active.is_(True),
                    Deal.review_status.in_(PUBLISHED_REVIEWS),
                    or_(Deal.starts_at.is_(None), Deal.starts_at <= generated_at),
                    or_(Deal.expires_at.is_(None), Deal.expires_at > generated_at),
                )
                .group_by(Deal.provider_id)
            )
        ).all()
        deal_counts = {provider_id: int(count) for provider_id, count in deal_rows}

    items: list[DashboardSubscriptionItem] = []
    for subscription in subscriptions:
        current = matches.get(subscription.id)
        match = current[0] if current else None
        plan = current[1] if current else None
        provider = current[2] if current else None
        items.append(
            DashboardSubscriptionItem(
                subscription_id=subscription.id,
                vendor_name=subscription.vendor_name,
                display_name=subscription.display_name,
                current_amount=_money(subscription.amount) or "0",
                currency=subscription.currency,
                billing_cycle=subscription.billing_cycle,
                renewal_or_expiry_date=subscription.renewal_or_expiry_date,
                creature_name=subscription.creature_name,
                creature_species=subscription.creature_species,
                match=_match_dto(match, plan, provider) if current else None,
                latest_price=latest_prices.get(plan.id) if plan else None,
                active_deal_count=deal_counts.get(provider.id, 0) if provider else 0,
                recommendations=recommendations_by_subscription[subscription.id],
            )
        )
    return PriceIntelligenceDashboard(
        summary=await summary(session, user), subscriptions=items, generated_at=generated_at
    )


async def confirm_match(
    session: AsyncSession,
    user: User,
    subscription_id: UUID,
    body: MatchConfirmationRequest,
) -> MatchConfirmationResponse:
    if body.status == "confirmed" and body.provider_plan_id is None:
        raise ApiError(
            "provider_plan_required",
            "provider_plan_id is required when confirming a match",
            422,
        )
    if body.status != "confirmed" and body.provider_plan_id is not None:
        raise ApiError(
            "provider_plan_not_allowed",
            "provider_plan_id is only valid when confirming a match",
            422,
        )
    await _owned_subscription(session, user, subscription_id)
    row = (
        await session.execute(
            select(UserPlanMatch, ProviderPlan, Provider)
            .join(ProviderPlan, ProviderPlan.id == UserPlanMatch.provider_plan_id)
            .join(Provider, Provider.id == UserPlanMatch.provider_id)
            .where(
                UserPlanMatch.id == body.match_id,
                UserPlanMatch.user_id == user.id,
                UserPlanMatch.subscription_id == subscription_id,
            )
        )
    ).one_or_none()
    if row is None:
        raise ApiError("match_not_found", "Merchant match was not found", 404)
    match, plan, provider = row
    if _utc(match.updated_at) != _utc(body.expected_updated_at):
        raise ApiError("stale_match", "Merchant match changed; refresh and retry", 409)
    if body.status == "confirmed":
        selected = await session.get(ProviderPlan, body.provider_plan_id)
        if selected is None or not selected.active or selected.provider_id != match.provider_id:
            raise ApiError(
                "invalid_provider_plan", "Provider plan is not valid for this match", 422
            )
        match.provider_plan_id = selected.id
        plan = selected
        match.confirmed_at = datetime.now(UTC)
    else:
        match.confirmed_at = None
    match.status = MatchStatus(body.status)
    await session.flush()
    return MatchConfirmationResponse(match=_match_dto(match, plan, provider))


async def record_feedback(
    session: AsyncSession,
    user: User,
    recommendation_id: UUID,
    body: RecommendationFeedbackRequest,
) -> RecommendationItem:
    if (body.feedback == "not_helpful" or body.status == "dismissed") and not (
        body.reason and body.reason.strip()
    ):
        raise ApiError(
            "feedback_reason_required",
            "A reason is required for negative or dismissed feedback",
            422,
        )
    item = await session.scalar(
        select(UserRecommendation)
        .join(Subscription, Subscription.id == UserRecommendation.subscription_id)
        .where(
            UserRecommendation.id == recommendation_id,
            UserRecommendation.user_id == user.id,
            Subscription.user_id == user.id,
            Subscription.archived_at.is_(None),
        )
    )
    if item is None:
        raise ApiError("recommendation_not_found", "Recommendation was not found", 404)
    now = datetime.now(UTC)
    if item.expires_at is not None and _utc(item.expires_at) <= now:
        raise ApiError("recommendation_expired", "Recommendation has expired", 409)
    target = RecommendationStatus(body.status)
    finalized = (RecommendationStatus.dismissed, RecommendationStatus.accepted)
    if item.status in finalized and item.status is not target:
        raise ApiError("recommendation_finalized", "Recommendation is already finalized", 409)
    item.status = target
    item.feedback = body.feedback
    item.feedback_reason = body.reason.strip() if body.reason else None
    if target is RecommendationStatus.seen:
        item.seen_at = item.seen_at or now
    elif target is RecommendationStatus.dismissed:
        item.dismissed_at = item.dismissed_at or now
    elif target is RecommendationStatus.accepted:
        item.accepted_at = item.accepted_at or now
    await session.flush()
    return _recommendation_dto(item)
