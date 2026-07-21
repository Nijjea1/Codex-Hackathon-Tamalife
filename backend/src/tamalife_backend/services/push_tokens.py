from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.db.base import utcnow
from tamalife_backend.db.models import DevicePlatform, DevicePushToken, User
from tamalife_backend.errors import ApiError

logger = structlog.get_logger("tamalife.push_tokens")


def _upsert(session: AsyncSession) -> Any:
    """Return the ON CONFLICT-capable insert for the session's dialect."""
    return pg_insert if session.get_bind().dialect.name == "postgresql" else sqlite_insert


async def register_push_token(
    session: AsyncSession,
    user: User,
    token: str,
    platform: DevicePlatform,
) -> DevicePushToken:
    """Claim a device push token for the current user.

    Device tokens are globally unique per app install, so an existing row is
    reassigned rather than rejected: the same handset can outlive an account
    switch, and Firebase re-issues the same token to a reinstalled app. A
    single upsert keeps that claim atomic against concurrent registrations.
    """
    now = utcnow()
    statement = (
        _upsert(session)(DevicePushToken)
        .values(user_id=user.id, token=token, platform=platform, last_seen_at=now)
        .on_conflict_do_update(
            index_elements=[DevicePushToken.token],
            set_={
                "user_id": user.id,
                "platform": platform,
                "last_seen_at": now,
                "updated_at": now,
            },
        )
        .returning(DevicePushToken)
    )
    record: DevicePushToken | None = await session.scalar(statement)
    if record is None:
        raise ApiError("db_error", "Could not register the device token", 500)
    logger.info("push_token_registered", user_id=str(user.id))
    return record


async def revoke_push_token(session: AsyncSession, user: User, token: str) -> None:
    """Release a device token owned by the current user. Idempotent."""
    deleted_id = await session.scalar(
        delete(DevicePushToken)
        .where(
            DevicePushToken.token == token,
            DevicePushToken.user_id == user.id,
        )
        .returning(DevicePushToken.id)
    )
    if deleted_id is not None:
        logger.info("push_token_revoked", user_id=str(user.id))
        return

    # Keep a missing token idempotent while hiding tokens owned by another
    # account behind the same not-found response. The ownership predicate is
    # part of the DELETE itself so a concurrent token reassignment cannot make
    # us delete the new owner's row after checking the old owner.
    exists = await session.scalar(select(DevicePushToken.id).where(DevicePushToken.token == token))
    if exists is not None:
        raise ApiError("push_token_not_found", "Device token not found", 404)
