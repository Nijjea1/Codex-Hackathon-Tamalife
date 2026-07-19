from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.config import Settings
from tamalife_backend.db.models import User
from tamalife_backend.errors import ApiError
from tamalife_backend.services.auth import get_clerk_client

logger = structlog.get_logger("tamalife.users")


def _primary_email(data: dict[str, Any]) -> str | None:
    addresses = data.get("email_addresses")
    if not isinstance(addresses, list):
        return None
    primary_id = data.get("primary_email_address_id")
    candidates = [address for address in addresses if isinstance(address, dict)]
    primary = next((address for address in candidates if address.get("id") == primary_id), None)
    selected = primary or (candidates[0] if candidates else None)
    value = selected.get("email_address") if selected else None
    return value if isinstance(value, str) and value else None


def _display_name(data: dict[str, Any]) -> str | None:
    parts = [data.get("first_name"), data.get("last_name")]
    name = " ".join(part.strip() for part in parts if isinstance(part, str) and part.strip())
    return name or None


async def get_or_create_user(
    session: AsyncSession,
    clerk_user_id: str,
    settings: Settings,
) -> User:
    """Return the local Clerk user, creating it from Clerk on first use."""
    try:
        user = await session.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    except SQLAlchemyError as exc:
        raise ApiError("db_error", "Could not load the authenticated user", 500) from exc

    if user is not None:
        logger.info("user_synced", clerk_user_id=clerk_user_id, created=False)
        return user

    try:
        clerk_user = await asyncio.to_thread(
            get_clerk_client(settings).users.get,
            user_id=clerk_user_id,
        )
        clerk_data = clerk_user.model_dump(mode="python")
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(
            "clerk_user_lookup_failed",
            "Could not load the authenticated Clerk profile",
            502,
        ) from exc

    user = User(
        clerk_user_id=clerk_user_id,
        email=_primary_email(clerk_data),
        display_name=_display_name(clerk_data),
        image_url=(
            clerk_data["image_url"]
            if isinstance(clerk_data.get("image_url"), str) and clerk_data["image_url"]
            else None
        ),
    )
    try:
        async with session.begin_nested():
            session.add(user)
            await session.flush()
    except IntegrityError as exc:
        try:
            existing = await session.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
        except SQLAlchemyError as lookup_exc:
            raise ApiError(
                "db_error", "Could not create the authenticated user", 500
            ) from lookup_exc
        if existing is None:
            raise ApiError("db_error", "Could not create the authenticated user", 500) from exc
        logger.info("user_synced", clerk_user_id=clerk_user_id, created=False)
        return existing
    except SQLAlchemyError as exc:
        raise ApiError("db_error", "Could not create the authenticated user", 500) from exc

    logger.info("user_synced", clerk_user_id=clerk_user_id, created=True)
    return user


async def synchronize_clerk_user(
    session: AsyncSession,
    event_type: str,
    data: dict[str, Any],
    settings: Settings,
    *,
    now: datetime | None = None,
) -> User | None:
    clerk_user_id = data.get("id")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        return None
    timestamp = now or datetime.now(UTC)
    user = await session.scalar(select(User).where(User.clerk_user_id == clerk_user_id))

    if event_type == "user.deleted":
        if user is None:
            user = User(clerk_user_id=clerk_user_id)
            session.add(user)
        user.disabled_at = user.disabled_at or timestamp
        user.deleted_at = user.deleted_at or timestamp
        if settings.clerk_deleted_user_policy == "anonymize":
            user.email = None
            user.display_name = None
            user.image_url = None
        await session.flush()
        return user

    if event_type not in {"user.created", "user.updated"}:
        return user
    if user is not None and user.deleted_at is not None:
        return user
    if user is None:
        user = User(clerk_user_id=clerk_user_id)
        session.add(user)

    user.email = _primary_email(data)
    user.display_name = _display_name(data)
    image_url = data.get("image_url")
    user.image_url = image_url if isinstance(image_url, str) and image_url else None
    user.deleted_at = None
    user.disabled_at = (
        timestamp if data.get("banned") is True or data.get("locked") is True else None
    )
    await session.flush()
    return user
