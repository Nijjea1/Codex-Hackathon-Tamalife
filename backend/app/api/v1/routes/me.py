"""Protected identity endpoint.

Proves the whole auth chain end to end: a valid Clerk bearer token in, the
caller's verified identity out. Any 401 here means the token was missing,
expired, or invalid.
"""

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.schemas.auth import CurrentUser, ErrorEnvelope, MeResponse

router = APIRouter(tags=["me"])


@router.get(
    "/me",
    response_model=MeResponse,
    responses={401: {"model": ErrorEnvelope, "description": "Not authenticated"}},
)
async def read_me(user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        clerk_user_id=user.clerk_user_id,
        session_id=user.session_id,
        claims=user.claims,
    )
