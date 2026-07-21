from fastapi import APIRouter
from sqlalchemy import select

from tamalife_backend.api.dependencies import SessionDep, UserDep
from tamalife_backend.db.models import NotificationPreference
from tamalife_backend.schemas import (
    NotificationPreferencesResponse,
    NotificationPreferencesUpdate,
)

router = APIRouter(prefix="/notification-preferences", tags=["notifications"])


async def get_or_create(session: SessionDep, user: UserDep) -> NotificationPreference:
    preference = await session.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    if preference is None:
        preference = NotificationPreference(user_id=user.id)
        session.add(preference)
        await session.flush()
    return preference


def response(preference: NotificationPreference) -> NotificationPreferencesResponse:
    return NotificationPreferencesResponse(
        reminder_days_before=preference.reminder_days_before,
        push_enabled=preference.push_enabled,
        email_enabled=preference.email_enabled,
    )


@router.get("", response_model=NotificationPreferencesResponse)
async def read_preferences(session: SessionDep, user: UserDep) -> NotificationPreferencesResponse:
    return response(await get_or_create(session, user))


@router.patch("", response_model=NotificationPreferencesResponse)
async def update_preferences(
    body: NotificationPreferencesUpdate, session: SessionDep, user: UserDep
) -> NotificationPreferencesResponse:
    preference = await get_or_create(session, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(preference, field, value)
    return response(preference)
