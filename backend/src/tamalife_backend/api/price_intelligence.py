from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from tamalife_backend.api.dependencies import SessionDep, UserDep
from tamalife_backend.price_intelligence_schemas import (
    AlternativesResponse,
    DealsResponse,
    MatchConfirmationRequest,
    MatchConfirmationResponse,
    PriceHistoryResponse,
    PriceIntelligenceDashboard,
    PriceIntelligenceSummary,
    RecommendationFeedbackRequest,
    RecommendationItem,
    SubscriptionIntelligenceResponse,
)
from tamalife_backend.services.price_intelligence import (
    alternatives,
    confirm_match,
    dashboard,
    deals,
    price_history,
    record_feedback,
    subscription_intelligence,
    summary,
)

router = APIRouter(tags=["price-intelligence"])


@router.get("/price-intelligence/summary", response_model=PriceIntelligenceSummary)
async def get_summary(session: SessionDep, user: UserDep) -> PriceIntelligenceSummary:
    return await summary(session, user)


@router.get("/price-intelligence/dashboard", response_model=PriceIntelligenceDashboard)
async def get_dashboard(session: SessionDep, user: UserDep) -> PriceIntelligenceDashboard:
    return await dashboard(session, user)


@router.get(
    "/subscriptions/{subscription_id}/intelligence",
    response_model=SubscriptionIntelligenceResponse,
)
async def get_subscription_intelligence(
    subscription_id: UUID, session: SessionDep, user: UserDep
) -> SubscriptionIntelligenceResponse:
    return await subscription_intelligence(session, user, subscription_id)


@router.get("/subscriptions/{subscription_id}/price-history", response_model=PriceHistoryResponse)
async def get_price_history(
    subscription_id: UUID, session: SessionDep, user: UserDep
) -> PriceHistoryResponse:
    return await price_history(session, user, subscription_id)


@router.get("/subscriptions/{subscription_id}/deals", response_model=DealsResponse)
async def get_deals(subscription_id: UUID, session: SessionDep, user: UserDep) -> DealsResponse:
    return await deals(session, user, subscription_id)


@router.get("/subscriptions/{subscription_id}/alternatives", response_model=AlternativesResponse)
async def get_alternatives(
    subscription_id: UUID, session: SessionDep, user: UserDep
) -> AlternativesResponse:
    return await alternatives(session, user, subscription_id)


@router.post(
    "/subscriptions/{subscription_id}/match-confirmation",
    response_model=MatchConfirmationResponse,
)
async def post_match_confirmation(
    subscription_id: UUID,
    body: MatchConfirmationRequest,
    session: SessionDep,
    user: UserDep,
) -> MatchConfirmationResponse:
    return await confirm_match(session, user, subscription_id, body)


@router.post("/recommendations/{recommendation_id}/feedback", response_model=RecommendationItem)
async def post_recommendation_feedback(
    recommendation_id: UUID,
    body: RecommendationFeedbackRequest,
    session: SessionDep,
    user: UserDep,
) -> RecommendationItem:
    return await record_feedback(session, user, recommendation_id, body)
