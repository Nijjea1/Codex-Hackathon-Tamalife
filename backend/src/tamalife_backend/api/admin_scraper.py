from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from tamalife_backend.admin_schemas import (
    CandidateList,
    CandidateResponse,
    DealReviewList,
    DealReviewResponse,
    PriceReviewList,
    PriceReviewResponse,
    RejectRequest,
    SourceResponse,
    SupersedeRequest,
)
from tamalife_backend.api.dependencies import AdminUserDep, SessionDep
from tamalife_backend.db.models import (
    CandidateStatus,
    Deal,
    PlanPriceHistory,
    ReviewStatus,
    SourceCandidate,
)
from tamalife_backend.services.admin_scraper import (
    approve_candidate,
    pause_source,
    reject_candidate,
    resume_source,
    review_deal,
    review_price,
    supersede_source,
)

router = APIRouter(prefix="/admin/scraper", tags=["admin-scraper"])


@router.get("/candidates", response_model=CandidateList)
async def list_candidates(
    session: SessionDep,
    _admin: AdminUserDep,
    status: CandidateStatus | None = None,
    limit: int = Query(50, ge=1, le=100),
    cursor: UUID | None = None,
) -> CandidateList:
    query = select(SourceCandidate).order_by(SourceCandidate.id).limit(limit + 1)
    if status is not None:
        query = query.where(SourceCandidate.status == status)
    if cursor is not None:
        query = query.where(SourceCandidate.id > cursor)
    items = list((await session.scalars(query)).all())
    has_more = len(items) > limit
    items = items[:limit]
    return CandidateList(
        items=[CandidateResponse.model_validate(item) for item in items],
        next_cursor=items[-1].id if has_more else None,
    )


@router.post("/candidates/{candidate_id}/approve", response_model=SourceResponse)
async def approve_candidate_route(
    candidate_id: UUID, session: SessionDep, _admin: AdminUserDep
) -> SourceResponse:
    return SourceResponse.model_validate(await approve_candidate(session, candidate_id))


@router.post("/candidates/{candidate_id}/reject", response_model=CandidateResponse)
async def reject_candidate_route(
    candidate_id: UUID,
    body: RejectRequest,
    session: SessionDep,
    _admin: AdminUserDep,
) -> CandidateResponse:
    return CandidateResponse.model_validate(
        await reject_candidate(session, candidate_id, body.reason)
    )


@router.post("/sources/{source_id}/pause", response_model=SourceResponse)
async def pause_source_route(
    source_id: UUID, session: SessionDep, _admin: AdminUserDep
) -> SourceResponse:
    return SourceResponse.model_validate(await pause_source(session, source_id))


@router.post("/sources/{source_id}/resume", response_model=SourceResponse)
async def resume_source_route(
    source_id: UUID, session: SessionDep, _admin: AdminUserDep
) -> SourceResponse:
    return SourceResponse.model_validate(await resume_source(session, source_id))


@router.post("/sources/{source_id}/supersede", response_model=SourceResponse)
async def supersede_source_route(
    source_id: UUID,
    body: SupersedeRequest,
    session: SessionDep,
    _admin: AdminUserDep,
) -> SourceResponse:
    return SourceResponse.model_validate(
        await supersede_source(session, source_id, body.replacement_source_id)
    )


@router.get("/price-reviews", response_model=PriceReviewList)
async def list_price_reviews(
    session: SessionDep,
    _admin: AdminUserDep,
    status: ReviewStatus = ReviewStatus.pending,
    limit: int = Query(50, ge=1, le=100),
    cursor: UUID | None = None,
) -> PriceReviewList:
    query = (
        select(PlanPriceHistory)
        .where(PlanPriceHistory.review_status == status)
        .order_by(PlanPriceHistory.id)
        .limit(limit + 1)
    )
    if cursor is not None:
        query = query.where(PlanPriceHistory.id > cursor)
    items = list((await session.scalars(query)).all())
    has_more = len(items) > limit
    items = items[:limit]
    return PriceReviewList(
        items=[PriceReviewResponse.model_validate(item) for item in items],
        next_cursor=items[-1].id if has_more else None,
    )


@router.post("/price-reviews/{history_id}/approve", response_model=PriceReviewResponse)
async def approve_price_review(
    history_id: UUID, session: SessionDep, _admin: AdminUserDep
) -> PriceReviewResponse:
    return PriceReviewResponse.model_validate(
        await review_price(session, history_id, ReviewStatus.approved)
    )


@router.post("/price-reviews/{history_id}/reject", response_model=PriceReviewResponse)
async def reject_price_review(
    history_id: UUID, session: SessionDep, _admin: AdminUserDep
) -> PriceReviewResponse:
    return PriceReviewResponse.model_validate(
        await review_price(session, history_id, ReviewStatus.rejected)
    )


@router.get("/deal-reviews", response_model=DealReviewList)
async def list_deal_reviews(
    session: SessionDep,
    _admin: AdminUserDep,
    status: ReviewStatus = ReviewStatus.pending,
    limit: int = Query(50, ge=1, le=100),
    cursor: UUID | None = None,
) -> DealReviewList:
    query = select(Deal).where(Deal.review_status == status).order_by(Deal.id).limit(limit + 1)
    if cursor is not None:
        query = query.where(Deal.id > cursor)
    items = list((await session.scalars(query)).all())
    has_more = len(items) > limit
    items = items[:limit]
    return DealReviewList(
        items=[DealReviewResponse.model_validate(item) for item in items],
        next_cursor=items[-1].id if has_more else None,
    )


@router.post("/deal-reviews/{deal_id}/approve", response_model=DealReviewResponse)
async def approve_deal_review(
    deal_id: UUID, session: SessionDep, _admin: AdminUserDep
) -> DealReviewResponse:
    return DealReviewResponse.model_validate(
        await review_deal(session, deal_id, ReviewStatus.approved)
    )


@router.post("/deal-reviews/{deal_id}/reject", response_model=DealReviewResponse)
async def reject_deal_review(
    deal_id: UUID, session: SessionDep, _admin: AdminUserDep
) -> DealReviewResponse:
    return DealReviewResponse.model_validate(
        await review_deal(session, deal_id, ReviewStatus.rejected)
    )
