from __future__ import annotations

from fastapi import APIRouter

from tamalife_backend.api.dependencies import AuthenticatedUserDep
from tamalife_backend.schemas import MeResponse

router = APIRouter(prefix="/me", tags=["identity"])


@router.get("", response_model=MeResponse)
async def read_me(authenticated: AuthenticatedUserDep) -> MeResponse:
    return MeResponse(
        user_id=authenticated.user.id,
        clerk_user_id=authenticated.clerk_user_id,
        session_id=authenticated.session_id,
        claims=authenticated.claims,
    )
