from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.db.models import (
    CandidateStatus,
    Deal,
    PlanPriceHistory,
    PricingSource,
    ReviewStatus,
    SourceCandidate,
    SourceStatus,
)
from tamalife_backend.errors import ApiError

VERIFIED_CANDIDATE_STATUSES = (CandidateStatus.verified, CandidateStatus.active)


async def approve_candidate(session: AsyncSession, candidate_id: UUID) -> PricingSource:
    candidate = await session.get(SourceCandidate, candidate_id)
    if candidate is None:
        raise ApiError("candidate_not_found", "Source candidate was not found", 404)
    if candidate.status is CandidateStatus.rejected:
        raise ApiError("candidate_rejected", "A rejected candidate cannot be approved", 409)
    if candidate.provider_id is None:
        raise ApiError("candidate_provider_required", "Candidate must be linked to a provider", 409)
    if candidate.activated_source_id is not None:
        source = await session.get(PricingSource, candidate.activated_source_id)
        if source is None:
            raise ApiError("candidate_source_missing", "Activated candidate source is missing", 409)
        return source

    existing = await session.scalar(
        select(PricingSource).where(
            PricingSource.normalized_url_hash == candidate.normalized_url_hash,
            PricingSource.country == candidate.country,
            PricingSource.language == candidate.language,
        )
    )
    now = datetime.now(UTC)
    if existing is None:
        existing = PricingSource(
            provider_id=candidate.provider_id,
            discovery_candidate_id=candidate.id,
            canonical_url=candidate.normalized_url,
            normalized_url_hash=candidate.normalized_url_hash,
            source_type=candidate.source_type,
            country=candidate.country,
            currency=candidate.currency,
            language=candidate.language,
            status=SourceStatus.active,
            next_check_at=now,
            discovery_confidence=candidate.confidence,
            first_discovered_at=now,
        )
        session.add(existing)
        await session.flush()
    elif existing.provider_id != candidate.provider_id:
        raise ApiError("candidate_source_conflict", "URL belongs to another provider", 409)
    candidate.status = CandidateStatus.active
    candidate.verified_at = candidate.verified_at or now
    candidate.activated_source_id = existing.id
    return existing


async def reject_candidate(
    session: AsyncSession, candidate_id: UUID, reason: str
) -> SourceCandidate:
    candidate = await session.get(SourceCandidate, candidate_id)
    if candidate is None:
        raise ApiError("candidate_not_found", "Source candidate was not found", 404)
    if candidate.status is CandidateStatus.active or candidate.activated_source_id is not None:
        raise ApiError("candidate_already_active", "An activated candidate cannot be rejected", 409)
    candidate.status = CandidateStatus.rejected
    candidate.rejection_reason = reason.strip()
    return candidate


async def pause_source(session: AsyncSession, source_id: UUID) -> PricingSource:
    source = await session.get(PricingSource, source_id)
    if source is None:
        raise ApiError("source_not_found", "Pricing source was not found", 404)
    if source.status is SourceStatus.superseded:
        raise ApiError("source_superseded", "A superseded source cannot be paused", 409)
    source.status = SourceStatus.paused
    source.lease_token = None
    source.lease_expires_at = None
    return source


async def resume_source(session: AsyncSession, source_id: UUID) -> PricingSource:
    source = await session.get(PricingSource, source_id)
    if source is None:
        raise ApiError("source_not_found", "Pricing source was not found", 404)
    if source.status is not SourceStatus.paused:
        raise ApiError("source_not_paused", "Only paused sources can be resumed", 409)
    source.status = SourceStatus.active
    source.next_check_at = datetime.now(UTC)
    source.consecutive_failures = 0
    return source


async def _assert_verified_replacement(
    session: AsyncSession, source: PricingSource, replacement: PricingSource
) -> None:
    if replacement.status is not SourceStatus.active:
        raise ApiError("replacement_not_active", "Replacement source must be active", 409)
    if replacement.last_success_at is None:
        raise ApiError(
            "replacement_not_monitored",
            "Replacement source must complete a successful monitored fetch",
            409,
        )
    if replacement.provider_id != source.provider_id or replacement.country != source.country:
        raise ApiError(
            "replacement_scope_mismatch",
            "Replacement must have the same provider and country",
            409,
        )
    if replacement.discovery_candidate_id is None:
        raise ApiError("replacement_not_verified", "Replacement source is not verified", 409)
    candidate = await session.get(SourceCandidate, replacement.discovery_candidate_id)
    if candidate is None or candidate.status not in VERIFIED_CANDIDATE_STATUSES:
        raise ApiError("replacement_not_verified", "Replacement source is not verified", 409)


async def _assert_no_supersession_cycle(
    session: AsyncSession, source_id: UUID, replacement: PricingSource
) -> None:
    seen: set[UUID] = set()
    current: PricingSource | None = replacement
    while current is not None:
        if current.id == source_id:
            raise ApiError("supersession_cycle", "Source supersession would create a cycle", 409)
        if current.id in seen:
            raise ApiError("supersession_cycle", "Replacement chain already contains a cycle", 409)
        seen.add(current.id)
        current = (
            await session.get(PricingSource, current.superseded_source_id)
            if current.superseded_source_id
            else None
        )


async def supersede_source(
    session: AsyncSession, source_id: UUID, replacement_source_id: UUID
) -> PricingSource:
    source = await session.get(PricingSource, source_id)
    if source is None:
        raise ApiError("source_not_found", "Pricing source was not found", 404)
    replacement = await session.get(PricingSource, replacement_source_id)
    if replacement is None:
        raise ApiError("replacement_not_found", "Replacement source was not found", 404)
    if source.superseded_source_id == replacement.id and source.status is SourceStatus.superseded:
        return source
    if source.status is SourceStatus.superseded:
        raise ApiError("source_already_superseded", "Source already has a replacement", 409)
    await _assert_verified_replacement(session, source, replacement)
    await _assert_no_supersession_cycle(session, source.id, replacement)
    source.status = SourceStatus.superseded
    source.superseded_source_id = replacement.id
    source.lease_token = None
    source.lease_expires_at = None
    return source


async def review_price(
    session: AsyncSession, history_id: UUID, target: ReviewStatus
) -> PlanPriceHistory:
    item = await session.get(PlanPriceHistory, history_id)
    if item is None:
        raise ApiError("price_review_not_found", "Price review was not found", 404)
    if item.review_status is not ReviewStatus.pending and item.review_status is not target:
        raise ApiError("price_review_conflict", "Price review is already finalized", 409)
    item.review_status = target
    return item


async def review_deal(session: AsyncSession, deal_id: UUID, target: ReviewStatus) -> Deal:
    item = await session.get(Deal, deal_id)
    if item is None:
        raise ApiError("deal_review_not_found", "Deal review was not found", 404)
    if item.review_status is not ReviewStatus.pending and item.review_status is not target:
        raise ApiError("deal_review_conflict", "Deal review is already finalized", 409)
    item.review_status = target
    item.active = target is ReviewStatus.approved
    return item
