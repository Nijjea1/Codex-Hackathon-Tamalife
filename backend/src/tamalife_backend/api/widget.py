from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from tamalife_backend.api.dependencies import (
    CacheDep,
    SessionDep,
    SettingsDep,
    UserDep,
    WidgetUserDep,
)
from tamalife_backend.db.models import Subscription, SubscriptionStatus, WidgetToken
from tamalife_backend.schemas import WidgetSummary, WidgetTokenResponse
from tamalife_backend.services.subscriptions import to_response, totals

router = APIRouter(prefix="/widget", tags=["widget"])


@router.post("/token", response_model=WidgetTokenResponse, status_code=201)
async def mint_widget_token(
    session: SessionDep, user: UserDep, settings: SettingsDep
) -> WidgetTokenResponse:
    raw = secrets.token_urlsafe(48)
    expires = datetime.now(UTC) + timedelta(days=settings.widget_token_ttl_days)
    session.add(
        WidgetToken(
            user_id=user.id,
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            expires_at=expires,
        )
    )
    return WidgetTokenResponse(token=raw, expires_at=expires)


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
