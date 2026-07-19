"""Pydantic schemas for the auth layer."""

from typing import Any

from pydantic import BaseModel, Field


class CurrentUser(BaseModel):
    """The authenticated caller, derived from a verified Clerk session token.

    `clerk_user_id` is the Clerk `sub` claim — the stable identifier every
    per-user ownership check hangs off. `claims` is the full verified payload,
    kept available for callers that need more (e.g. session id, org id).
    """

    clerk_user_id: str
    session_id: str | None = None
    claims: dict[str, Any] = Field(default_factory=dict)


class MeResponse(BaseModel):
    clerk_user_id: str
    session_id: str | None = None
    claims: dict[str, Any]


class ErrorDetail(BaseModel):
    code: str
    message: str
    detail: dict[str, Any] | None = None


class ErrorEnvelope(BaseModel):
    """Consistent error shape for every endpoint (see design doc §6)."""

    error: ErrorDetail
