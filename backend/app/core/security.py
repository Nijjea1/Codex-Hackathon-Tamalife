"""Clerk session-token verification.

This is the only place that knows *how* auth works. Routes depend on
`get_current_user`; if the verification mechanism ever changes (e.g. swap the
official Clerk SDK for raw PyJWT + JWKS), only this file changes.

Flow (design doc §7):
  1. The mobile app signs the user in with Clerk and gets a session token.
  2. It calls us with `Authorization: Bearer <token>`.
  3. We hand the request to Clerk's SDK, which verifies the token against
     Clerk's JWKS (fetched once, then cached — "networkless" thereafter).
  4. Signed in  -> we return a typed CurrentUser.
     Not signed in -> we raise 401 in the standard error envelope.
"""

from functools import lru_cache

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from fastapi import Request, status

from app.config import Settings, get_settings
from app.core.errors import APIError
from app.schemas.auth import CurrentUser


@lru_cache
def get_clerk_client() -> Clerk:
    """One Clerk client per process, built from the Secret Key."""
    settings = get_settings()
    if not settings.clerk_secret_key:
        raise APIError(
            code="server_misconfigured",
            message="CLERK_SECRET_KEY is not set.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    return Clerk(bearer_auth=settings.clerk_secret_key)


def _to_httpx_request(request: Request) -> httpx.Request:
    """Adapt the incoming Starlette/FastAPI request into the httpx.Request
    shape Clerk's `authenticate_request` expects. Only method, URL and headers
    matter for verification (the Authorization header carries the token)."""
    return httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=list(request.headers.items()),
    )


def verify_token(request: Request, settings: Settings | None = None) -> CurrentUser:
    settings = settings or get_settings()
    clerk = get_clerk_client()

    options = AuthenticateRequestOptions(
        authorized_parties=settings.clerk_authorized_parties or None,
    )

    try:
        state = clerk.authenticate_request(_to_httpx_request(request), options)
    except Exception as exc:  # network/JWKS/SDK failure — treat as unauthorized
        raise APIError(
            code="unauthorized",
            message="Could not verify authentication token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        ) from exc

    if not state.is_signed_in:
        raise APIError(
            code="unauthorized",
            message="Authentication required.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"reason": str(getattr(state, "reason", "not_signed_in"))},
        )

    payload: dict = state.payload or {}
    subject = payload.get("sub")
    if not subject:
        raise APIError(
            code="unauthorized",
            message="Token is missing a subject claim.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    return CurrentUser(
        clerk_user_id=subject,
        session_id=payload.get("sid"),
        claims=payload,
    )


def get_current_user(request: Request) -> CurrentUser:
    """FastAPI dependency for protected routes: `Depends(get_current_user)`."""
    return verify_token(request)
