from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from fastapi import Request

from tamalife_backend.config import Settings
from tamalife_backend.errors import ApiError


@dataclass(frozen=True)
class ClerkIdentity:
    user_id: str
    session_id: str | None
    claims: dict[str, Any]


@lru_cache(maxsize=4)
def _clerk_client(secret_key: str) -> Clerk:
    return Clerk(bearer_auth=secret_key)


def _as_httpx_request(request: Request) -> httpx.Request:
    return httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=list(request.headers.items()),
    )


def verify_clerk_request(request: Request, settings: Settings) -> ClerkIdentity:
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer ") or not authorization.removeprefix("Bearer ").strip():
        raise ApiError("unauthorized", "Authentication required", 401)
    if not settings.clerk_secret_key:
        raise ApiError("server_misconfigured", "Clerk authentication is not configured", 500)

    options = AuthenticateRequestOptions(
        authorized_parties=settings.clerk_authorized_parties or None,
    )
    try:
        state = _clerk_client(settings.clerk_secret_key).authenticate_request(
            _as_httpx_request(request), options
        )
    except Exception as exc:
        raise ApiError("unauthorized", "Could not verify authentication token", 401) from exc

    if not state.is_signed_in:
        raise ApiError(
            "unauthorized",
            "Authentication required",
            401,
            {"reason": str(getattr(state, "reason", "not_signed_in"))},
        )
    claims: dict[str, Any] = dict(state.payload or {})
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise ApiError("unauthorized", "Token is missing a subject claim", 401)
    session_id = claims.get("sid")
    return ClerkIdentity(
        user_id=subject,
        session_id=session_id if isinstance(session_id, str) else None,
        claims=claims,
    )
