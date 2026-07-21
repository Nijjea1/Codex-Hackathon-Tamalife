from __future__ import annotations

import asyncio
import hashlib
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.config import Settings
from tamalife_backend.db.models import User, WidgetToken
from tamalife_backend.errors import ApiError
from tamalife_backend.services.auth import verify_clerk_request
from tamalife_backend.services.clerk_users import get_or_create_user
from tamalife_backend.services.extraction import Extractor
from tamalife_backend.services.metrics import Metrics
from tamalife_backend.services.redis import Cache, ParseRateLimiter
from tamalife_backend.services.storage import Storage

WIDGET_READ_SCOPE = "widget:read"


def settings_from(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    clerk_user_id: str
    session_id: str | None
    claims: dict[str, Any]


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def authenticated_user(
    request: Request,
    settings: Annotated[Settings, Depends(settings_from)],
    session: Annotated[AsyncSession, Depends(get_session)],
    x_user_id: Annotated[str | None, Header()] = None,
) -> AuthenticatedUser:
    if settings.clerk_auth_enabled:
        identity = await asyncio.to_thread(verify_clerk_request, request, settings)
        user = await get_or_create_user(session, identity.user_id, settings)
        if user.disabled_at is not None or user.deleted_at is not None:
            raise ApiError("account_disabled", "This account is disabled", 403)
        return AuthenticatedUser(user, identity.user_id, identity.session_id, identity.claims)

    user_id = settings.default_user_id
    if x_user_id and settings.environment != "production":
        try:
            user_id = UUID(x_user_id)
        except ValueError as exc:
            raise ApiError("invalid_user_id", "X-User-ID must be a UUID", 400) from exc
    local_user = await session.get(User, user_id)
    if local_user is None:
        local_user = User(
            id=user_id,
            email=settings.default_user_email if user_id == settings.default_user_id else None,
        )
        session.add(local_user)
        await session.flush()
    elif local_user.disabled_at is not None or local_user.deleted_at is not None:
        raise ApiError("account_disabled", "This account is disabled", 403)
    return AuthenticatedUser(local_user, f"development:{local_user.id}", None, {})


async def current_user(
    authenticated: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> User:
    return authenticated.user


async def admin_user(
    authenticated: Annotated[AuthenticatedUser, Depends(authenticated_user)],
    settings: Annotated[Settings, Depends(settings_from)],
) -> AuthenticatedUser:
    allowed = {value.strip() for value in settings.clerk_admin_user_ids if value.strip()}
    if not allowed or authenticated.clerk_user_id not in allowed:
        raise ApiError("admin_access_denied", "Administrator access is required", 403)
    return authenticated


async def widget_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError("widget_token_required", "A widget bearer token is required", 401)
    raw = authorization.removeprefix("Bearer ").strip()
    digest = hashlib.sha256(raw.encode()).hexdigest()
    now = datetime.now(UTC)
    result = await session.execute(
        select(WidgetToken).where(
            WidgetToken.token_hash == digest,
            WidgetToken.scope == WIDGET_READ_SCOPE,
            WidgetToken.revoked_at.is_(None),
            WidgetToken.expires_at > now,
        )
    )
    token = result.scalar_one_or_none()
    if token is None:
        raise ApiError("invalid_widget_token", "Widget token is invalid or expired", 401)
    token.last_used_at = now
    user = await session.get(User, token.user_id)
    if user is None:
        raise ApiError("invalid_widget_token", "Widget token owner no longer exists", 401)
    if user.disabled_at is not None or user.deleted_at is not None:
        raise ApiError("invalid_widget_token", "Widget token owner is disabled", 401)
    return user


def extractor_from(request: Request) -> Extractor:
    return cast(Extractor, request.app.state.extractor)


def storage_from(request: Request) -> Storage:
    return cast(Storage, request.app.state.storage)


def cache_from(request: Request) -> Cache:
    return cast(Cache, request.app.state.cache)


def limiter_from(request: Request) -> ParseRateLimiter:
    return cast(ParseRateLimiter, request.app.state.parse_limiter)


def metrics_from(request: Request) -> Metrics:
    return cast(Metrics, request.app.state.metrics)


SessionDep = Annotated[AsyncSession, Depends(get_session)]
AuthenticatedUserDep = Annotated[AuthenticatedUser, Depends(authenticated_user)]
AdminUserDep = Annotated[AuthenticatedUser, Depends(admin_user)]
UserDep = Annotated[User, Depends(current_user)]
WidgetUserDep = Annotated[User, Depends(widget_user)]
SettingsDep = Annotated[Settings, Depends(settings_from)]
ExtractorDep = Annotated[Extractor, Depends(extractor_from)]
StorageDep = Annotated[Storage, Depends(storage_from)]
CacheDep = Annotated[Cache, Depends(cache_from)]
LimiterDep = Annotated[ParseRateLimiter, Depends(limiter_from)]
MetricsDep = Annotated[Metrics, Depends(metrics_from)]
