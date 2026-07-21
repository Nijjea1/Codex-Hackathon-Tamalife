from fastapi import APIRouter, status

from tamalife_backend.api.dependencies import SessionDep, UserDep
from tamalife_backend.db.models import DevicePlatform, DevicePushToken
from tamalife_backend.schemas import (
    DevicePushTokenRegister,
    DevicePushTokenResponse,
    DevicePushTokenUnregister,
)
from tamalife_backend.services.push_tokens import register_push_token, revoke_push_token

router = APIRouter(prefix="/notifications", tags=["notifications"])


def response(record: DevicePushToken) -> DevicePushTokenResponse:
    return DevicePushTokenResponse(
        id=record.id,
        platform=record.platform.value,
        created_at=record.created_at,
        last_seen_at=record.last_seen_at,
    )


@router.post(
    "/push-tokens",
    response_model=DevicePushTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_device_push_token(
    body: DevicePushTokenRegister, session: SessionDep, user: UserDep
) -> DevicePushTokenResponse:
    record = await register_push_token(session, user, body.token, DevicePlatform(body.platform))
    return response(record)


@router.delete("/push-tokens", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device_push_token(
    body: DevicePushTokenUnregister, session: SessionDep, user: UserDep
) -> None:
    await revoke_push_token(session, user, body.token)
