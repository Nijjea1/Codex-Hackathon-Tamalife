from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from tamalife_backend.api.dependencies import CacheDep, SessionDep, UserDep
from tamalife_backend.db.models import (
    EventType,
    Subscription,
    SubscriptionEvent,
    SubscriptionStatus,
)
from tamalife_backend.errors import ApiError
from tamalife_backend.schemas import (
    ResolutionRequest,
    SubscriptionCreate,
    SubscriptionList,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from tamalife_backend.services.subscriptions import load_subscription, to_response

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


async def invalidate(cache: CacheDep, user_id: UUID) -> None:
    await cache.delete(f"widget:{user_id}")


@router.get("", response_model=SubscriptionList)
async def list_subscriptions(
    session: SessionDep,
    user: UserDep,
    limit: int = Query(50, ge=1, le=100),
    cursor: UUID | None = None,
) -> SubscriptionList:
    query = (
        select(Subscription)
        .options(selectinload(Subscription.events))
        .where(Subscription.user_id == user.id, Subscription.archived_at.is_(None))
        .order_by(Subscription.id)
        .limit(limit + 1)
    )
    if cursor:
        query = query.where(Subscription.id > cursor)
    items = list((await session.execute(query)).scalars().all())
    has_more = len(items) > limit
    items = items[:limit]
    return SubscriptionList(
        items=[to_response(item) for item in items],
        next_cursor=str(items[-1].id) if has_more else None,
    )


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    body: SubscriptionCreate,
    session: SessionDep,
    user: UserDep,
    cache: CacheDep,
) -> SubscriptionResponse:
    item = Subscription(user_id=user.id, **body.model_dump())
    session.add(item)
    await session.flush()
    await session.refresh(item, attribute_names=["events"])
    await invalidate(cache, user.id)
    return to_response(item)


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: UUID, session: SessionDep, user: UserDep
) -> SubscriptionResponse:
    item = await load_subscription(session, user, subscription_id)
    if item is None:
        raise ApiError("subscription_not_found", "Subscription was not found", 404)
    return to_response(item)


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: UUID,
    body: SubscriptionUpdate,
    session: SessionDep,
    user: UserDep,
    cache: CacheDep,
) -> SubscriptionResponse:
    item = await load_subscription(session, user, subscription_id)
    if item is None:
        raise ApiError("subscription_not_found", "Subscription was not found", 404)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await session.flush()
    await invalidate(cache, user.id)
    return to_response(item)


@router.delete("/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_subscription(
    subscription_id: UUID, session: SessionDep, user: UserDep, cache: CacheDep
) -> None:
    item = await load_subscription(session, user, subscription_id)
    if item is None:
        raise ApiError("subscription_not_found", "Subscription was not found", 404)
    item.archived_at = datetime.now(UTC)
    await invalidate(cache, user.id)


@router.patch("/{subscription_id}/resolve", response_model=SubscriptionResponse)
async def resolve_subscription(
    subscription_id: UUID,
    body: ResolutionRequest,
    session: SessionDep,
    user: UserDep,
    cache: CacheDep,
) -> SubscriptionResponse:
    item = await load_subscription(session, user, subscription_id)
    if item is None:
        raise ApiError("subscription_not_found", "Subscription was not found", 404)

    event_type = EventType(f"resolved_{body.action}")
    if body.idempotency_key:
        existing = await session.scalar(
            select(SubscriptionEvent).where(
                SubscriptionEvent.subscription_id == item.id,
                SubscriptionEvent.idempotency_key == body.idempotency_key,
            )
        )
        if existing:
            return to_response(item)

    event = SubscriptionEvent(
        subscription_id=item.id,
        event_type=event_type,
        occurred_at=body.occurred_at or datetime.now(UTC),
        data=body.metadata,
        idempotency_key=body.idempotency_key,
    )
    session.add(event)
    if body.action == "cancel":
        item.status = SubscriptionStatus.canceled
    elif body.action == "dispute":
        item.status = SubscriptionStatus.disputed
    else:
        item.status = SubscriptionStatus.active
    if body.next_date is not None:
        item.renewal_or_expiry_date = body.next_date
    try:
        await session.flush()
    except IntegrityError as exc:
        raise ApiError("idempotency_conflict", "Idempotency key was already used", 409) from exc
    item.events.append(event)
    await invalidate(cache, user.id)
    return to_response(item)
