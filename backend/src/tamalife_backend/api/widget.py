from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from tamalife_backend.api.dependencies import (
    WIDGET_READ_SCOPE,
    CacheDep,
    SessionDep,
    SettingsDep,
    UserDep,
    WidgetUserDep,
)
from tamalife_backend.db.models import Subscription, SubscriptionStatus, WidgetToken
from tamalife_backend.errors import ApiError
from tamalife_backend.schemas import (
    WidgetSummary,
    WidgetTokenList,
    WidgetTokenMetadata,
    WidgetTokenResponse,
)
from tamalife_backend.services.subscriptions import to_response, totals

router = APIRouter(prefix="/widget", tags=["widget"])


def hash_widget_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def token_metadata(token: WidgetToken, *, now: datetime | None = None) -> WidgetTokenMetadata:
    reference = now or datetime.now(UTC)
    expires_at = token.expires_at
    comparable_expiry = expires_at.replace(tzinfo=UTC) if expires_at.tzinfo is None else expires_at
    return WidgetTokenMetadata(
        id=token.id,
        scope="widget:read",
        created_at=token.created_at,
        expires_at=token.expires_at,
        last_used_at=token.last_used_at,
        revoked_at=token.revoked_at,
        active=token.revoked_at is None and comparable_expiry > reference,
    )


async def create_widget_token(
    session: SessionDep, user: UserDep, settings: SettingsDep
) -> WidgetTokenResponse:
    raw = f"tlw_{secrets.token_urlsafe(48)}"
    now = datetime.now(UTC)
    record = WidgetToken(
        user_id=user.id,
        token_hash=hash_widget_token(raw),
        scope=WIDGET_READ_SCOPE,
        created_at=now,
        expires_at=now + timedelta(days=settings.widget_token_ttl_days),
    )
    session.add(record)
    await session.flush()
    return WidgetTokenResponse(
        id=record.id,
        token=raw,
        scope="widget:read",
        created_at=record.created_at,
        expires_at=record.expires_at,
    )


@router.post("/tokens", response_model=WidgetTokenResponse, status_code=status.HTTP_201_CREATED)
async def mint_widget_token(
    session: SessionDep, user: UserDep, settings: SettingsDep
) -> WidgetTokenResponse:
    return await create_widget_token(session, user, settings)


@router.post(
    "/token",
    response_model=WidgetTokenResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def mint_widget_token_compat(
    session: SessionDep, user: UserDep, settings: SettingsDep
) -> WidgetTokenResponse:
    return await create_widget_token(session, user, settings)


@router.get("/tokens", response_model=WidgetTokenList)
async def list_widget_tokens(session: SessionDep, user: UserDep) -> WidgetTokenList:
    records = list(
        (
            await session.scalars(
                select(WidgetToken)
                .where(
                    WidgetToken.user_id == user.id,
                    WidgetToken.scope == WIDGET_READ_SCOPE,
                )
                .order_by(WidgetToken.created_at.desc(), WidgetToken.id.desc())
            )
        ).all()
    )
    return WidgetTokenList(items=[token_metadata(record) for record in records])


async def owned_token(session: SessionDep, user: UserDep, token_id: UUID) -> WidgetToken:
    token = await session.scalar(
        select(WidgetToken).where(
            WidgetToken.id == token_id,
            WidgetToken.user_id == user.id,
            WidgetToken.scope == WIDGET_READ_SCOPE,
        )
    )
    if token is None:
        raise ApiError("widget_token_not_found", "Widget token was not found", 404)
    return token


@router.post("/tokens/{token_id}/rotate", response_model=WidgetTokenResponse)
async def rotate_widget_token(
    token_id: UUID,
    session: SessionDep,
    user: UserDep,
    settings: SettingsDep,
) -> WidgetTokenResponse:
    token = await owned_token(session, user, token_id)
    if token.revoked_at is not None:
        raise ApiError("widget_token_revoked", "Revoked widget tokens cannot be rotated", 409)
    token.revoked_at = datetime.now(UTC)
    return await create_widget_token(session, user, settings)


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_widget_token(token_id: UUID, session: SessionDep, user: UserDep) -> None:
    token = await owned_token(session, user, token_id)
    if token.revoked_at is None:
        token.revoked_at = datetime.now(UTC)


async def build_summary(session: SessionDep, user: WidgetUserDep) -> WidgetSummary:
    result = await session.execute(
        select(Subscription)
        .options(selectinload(Subscription.events))
        .where(
            Subscription.user_id == user.id,
            Subscription.archived_at.is_(None),
            Subscription.status == SubscriptionStatus.active,
        )
    )
    items = list(result.scalars().all())
    responses = [to_response(item) for item in items]
    monthly, annual = totals(items)
    attention = [item for item in responses if item.needs_attention]
    dated = [item for item in responses if item.renewal_or_expiry_date is not None]
    next_item = (
        min(dated, key=lambda item: item.renewal_or_expiry_date or date.max) if dated else None
    )
    return WidgetSummary(
        active_count=len(items),
        needs_attention_count=len(attention),
        monthly_cost=monthly,
        annual_cost=annual,
        next_item=next_item,
        generated_at=datetime.now(UTC),
    )


@router.get("/summary", response_model=WidgetSummary)
async def widget_summary(
    session: SessionDep, user: WidgetUserDep, cache: CacheDep, settings: SettingsDep
) -> WidgetSummary:
    key = f"widget:{user.id}"
    cached = await cache.get_json(key)
    if cached:
        return WidgetSummary.model_validate(cached)
    summary = await build_summary(session, user)
    await cache.set_json(key, summary.model_dump(mode="json"), settings.widget_cache_ttl_seconds)
    return summary
