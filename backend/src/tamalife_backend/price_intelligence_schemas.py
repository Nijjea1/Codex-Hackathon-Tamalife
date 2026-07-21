from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from tamalife_backend.db.models import (
    BillingCycle,
    MatchStatus,
    PriceChangeType,
    RecommendationStatus,
)


class IntelligenceModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceMetadata(IntelligenceModel):
    source_id: UUID
    source_url: str
    checked_at: datetime | None
    confidence: float


class MerchantMatch(IntelligenceModel):
    id: UUID
    provider_id: UUID
    provider_plan_id: UUID
    provider_name: str
    plan_name: str
    status: MatchStatus
    confidence: float
    method: str
    reason_codes: list[str]
    updated_at: datetime


class PricePoint(IntelligenceModel):
    id: UUID
    price: str
    promotional_price: str | None
    previous_price: str | None
    change_amount: str | None
    change_percentage: str | None
    change_type: PriceChangeType
    observed_at: datetime
    confidence: float
    source: SourceMetadata


class DealItem(IntelligenceModel):
    id: UUID
    title: str
    description: str | None
    regular_price: str | None
    promotional_price: str | None
    currency: str | None
    country: str
    eligibility: dict[str, object]
    starts_at: datetime | None
    expires_at: datetime | None
    confidence: float
    source: SourceMetadata


class AlternativeItem(IntelligenceModel):
    id: UUID
    provider_plan_id: UUID
    provider_name: str
    plan_name: str
    billing_cycle: BillingCycle
    current_price: str
    monthly_cost: str | None
    monthly_savings: str | None
    annual_savings: str | None
    feature_similarity: float
    switching_effort: int
    reason_codes: list[str]
    confidence: float
    fresh_at: datetime


class RecommendationItem(IntelligenceModel):
    id: UUID
    subscription_id: UUID
    recommendation_type: str
    target_plan_id: UUID | None
    deal_id: UUID | None
    estimated_monthly_savings: str | None
    estimated_annual_savings: str | None
    reason_codes: list[str]
    explanation: str
    confidence: float
    status: RecommendationStatus
    expires_at: datetime | None
    feedback: str | None
    feedback_reason: str | None
    updated_at: datetime


class PriceHistoryResponse(IntelligenceModel):
    subscription_id: UUID
    items: list[PricePoint]


class DealsResponse(IntelligenceModel):
    subscription_id: UUID
    items: list[DealItem]


class AlternativesResponse(IntelligenceModel):
    subscription_id: UUID
    items: list[AlternativeItem]


class SubscriptionIntelligenceResponse(IntelligenceModel):
    subscription_id: UUID
    match: MerchantMatch | None
    latest_price: PricePoint | None
    recommendations: list[RecommendationItem]
    generated_at: datetime


class PriceIntelligenceSummary(IntelligenceModel):
    subscription_count: int
    matched_count: int
    unmatched_count: int
    price_change_count: int
    active_deal_count: int
    recommendation_count: int
    estimated_monthly_savings: str
    estimated_annual_savings: str
    generated_at: datetime


class DashboardSubscriptionItem(IntelligenceModel):
    subscription_id: UUID
    vendor_name: str
    display_name: str
    current_amount: str
    currency: str
    billing_cycle: BillingCycle
    renewal_or_expiry_date: date | None
    creature_name: str
    creature_species: str
    match: MerchantMatch | None
    latest_price: PricePoint | None
    active_deal_count: int
    recommendations: list[RecommendationItem]


class PriceIntelligenceDashboard(IntelligenceModel):
    summary: PriceIntelligenceSummary
    subscriptions: list[DashboardSubscriptionItem]
    generated_at: datetime


class MatchConfirmationRequest(IntelligenceModel):
    match_id: UUID
    status: Literal["confirmed", "rejected", "unmatched"]
    provider_plan_id: UUID | None = None
    expected_updated_at: datetime


class MatchConfirmationResponse(IntelligenceModel):
    match: MerchantMatch


class RecommendationFeedbackRequest(IntelligenceModel):
    feedback: Literal["helpful", "not_helpful"]
    status: Literal["seen", "dismissed", "accepted"]
    reason: str | None = Field(default=None, max_length=500)
