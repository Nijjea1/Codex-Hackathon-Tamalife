from __future__ import annotations

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.db.base import utcnow
from tamalife_backend.db.models import DevicePlatform, DevicePushToken, User
from tamalife_backend.errors import ApiError

logger = structlog.get_logger("tamalife.push_tokens")


async def register_push_token(
    session: AsyncSession,
    user: User,
    token: str,
    platform: DevicePlatform,
) -> DevicePushToken:
    """Register (or re-claim) a device push token for the current user.

    A device token is globally unique, so the same token may already exist
    under a different signed-in user (e.g. account switch on one phone). In
    that case we reassign it rather than fail.
    """
    try:
        existing = await session.scalar(
            select(DevicePushToken).where(DevicePushToken.token == token)
        )
    except SQLAlchemyError as exc:
        raise ApiError("db_error", "Could not load the device token", 500) from exc

    if existing is not None:
        existing.user_id = user.id
        existing.platform = platform
        existing.last_seen_at = utcnow()
        try:
            await session.flush()
        except SQLAlchemyError as exc:
            raise ApiError("db_error", "Could not update the device token", 500) from exc
        logger.info("push_token_registered", user_id=str(user.id), created=False)
        return existing

    record = DevicePushToken(
        user_id=user.id,
        token=token,
        platform=platform,
        last_seen_at=utcnow(),
    )
    try:
        async with session.begin_nested():
            session.add(record)
            await session.flush()
    except IntegrityError:
        # Lost a race with a concurrent register of the same token: reclaim it.
        reclaimed: DevicePushToken | None = await session.scalar(
            select(DevicePushToken).where(DevicePushToken.token == token)
        )
        if reclaimed is None:
            raise ApiError("db_error", "Could not register the device token", 500) from None
        reclaimed.user_id = user.id
        reclaimed.platform = platform
        reclaimed.last_seen_at = utcnow()
        await session.flush()
        logger.info("push_token_registered", user_id=str(user.id), created=False)
        return reclaimed
    except SQLAlchemyError as exc:
        raise ApiError("db_error", "Could not register the device token", 500) from exc

    logger.info("push_token_registered", user_id=str(user.id), created=True)
    return record


async def revoke_push_token(session: AsyncSession, user: User, token: str) -> None:
    """Delete a device token owned by the current user. Idempotent."""
    try:
        record = await session.scalar(select(DevicePushToken).where(DevicePushToken.token == token))
    except SQLAlchemyError as exc:
        raise ApiError("db_error", "Could not load the device token", 500) from exc

    if record is None:
        return
    if record.user_id != user.id:
        raise ApiError("push_token_not_found", "Device token not found", 404)

    try:
        await session.delete(record)
        await session.flush()
    except SQLAlchemyError as exc:
        raise ApiError("db_error", "Could not revoke the device token", 500) from exc
    logger.info("push_token_revoked", user_id=str(user.id))
