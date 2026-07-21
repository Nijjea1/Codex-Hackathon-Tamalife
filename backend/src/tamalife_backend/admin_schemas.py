from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from tamalife_backend.db.models import (
    CandidateStatus,
    PriceChangeType,
    ReviewStatus,
    SourceStatus,
    SourceType,
)


class AdminModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class CandidateResponse(AdminModel):
    id: UUID
    provider_id: UUID | None
    normalized_url: str
    candidate_domain: str
    source_type: SourceType
    country: str
    currency: str | None
    language: str
    confidence: float
    first_party: bool
    status: CandidateStatus
    rejection_reason: str | None
    verified_at: datetime | None
    activated_source_id: UUID | None


class CandidateList(AdminModel):
    items: list[CandidateResponse]
    next_cursor: UUID | None = None


class RejectRequest(AdminModel):
    reason: str = Field(min_length=1, max_length=1000)


class SourceResponse(AdminModel):
    id: UUID
    provider_id: UUID
    discovery_candidate_id: UUID | None
    canonical_url: str
    source_type: SourceType
    country: str
    currency: str | None
    language: str
    status: SourceStatus
    next_check_at: datetime
    consecutive_failures: int
    superseded_source_id: UUID | None


class SupersedeRequest(AdminModel):
    replacement_source_id: UUID


class PriceReviewResponse(AdminModel):
    id: UUID
    plan_id: UUID
    price: Decimal
    previous_price: Decimal | None
    change_type: PriceChangeType
    observed_at: datetime
    confidence: float
    review_status: ReviewStatus


class PriceReviewList(AdminModel):
    items: list[PriceReviewResponse]
    next_cursor: UUID | None = None


class DealReviewResponse(AdminModel):
    id: UUID
    provider_id: UUID
    source_id: UUID
    title: str
    country: str
    confidence: float
    active: bool
    review_status: ReviewStatus


class DealReviewList(AdminModel):
    items: list[DealReviewResponse]
    next_cursor: UUID | None = None
