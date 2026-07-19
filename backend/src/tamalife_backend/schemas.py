from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from tamalife_backend.db.models import (
    BillingCycle,
    CancellationDifficulty,
    ItemType,
    ParseStatus,
    RawInputType,
    SubscriptionStatus,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SubscriptionCreate(StrictModel):
    vendor_name: str = Field(min_length=1, max_length=200)
    display_name: str = Field(min_length=1, max_length=200)
    item_type: ItemType = ItemType.subscription
    category: str = Field(default="Other", min_length=1, max_length=80)
    amount: Decimal = Field(ge=0, decimal_places=2)
    previous_amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    billing_cycle: BillingCycle
    renewal_or_expiry_date: date | None = None
    cancellation_difficulty: CancellationDifficulty = CancellationDifficulty.unknown
    creature_name: str = Field(default="Nova", min_length=1, max_length=80)
    creature_species: str = Field(default="blob", min_length=1, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str) -> str:
        return value.upper()


class SubscriptionUpdate(StrictModel):
    vendor_name: str | None = Field(default=None, min_length=1, max_length=200)
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    item_type: ItemType | None = None
    category: str | None = Field(default=None, min_length=1, max_length=80)
    amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    previous_amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    billing_cycle: BillingCycle | None = None
    renewal_or_expiry_date: date | None = None
    cancellation_difficulty: CancellationDifficulty | None = None
    creature_name: str | None = Field(default=None, min_length=1, max_length=80)
    creature_species: str | None = Field(default=None, min_length=1, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class SubscriptionResponse(StrictModel):
    id: UUID
    vendor_name: str
    display_name: str
    item_type: ItemType
    category: str
    amount: Decimal
    previous_amount: Decimal | None
    currency: str
    billing_cycle: BillingCycle
    renewal_or_expiry_date: date | None
    cancellation_difficulty: CancellationDifficulty
    status: SubscriptionStatus
    creature_name: str
    creature_species: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    days_remaining: int | None
    health_score: int
    mood: str
    needs_attention: bool
    health_reason: str
    monthly_cost: Decimal
    annual_cost: Decimal


class SubscriptionList(StrictModel):
    items: list[SubscriptionResponse]
    next_cursor: str | None = None


class ResolutionRequest(StrictModel):
    action: Literal["renew", "cancel", "dispute", "keep"]
    occurred_at: datetime | None = None
    next_date: date | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=200)


class Evidence(StrictModel):
    label: str
    snippet: str


class ExtractedReceipt(StrictModel):
    display_name: str
    vendor_name: str
    item_type: ItemType
    category: str
    amount: Decimal = Field(ge=0)
    previous_amount: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(min_length=3, max_length=3)
    billing_cycle: BillingCycle
    renewal_or_expiry_date: date | None
    cancellation_difficulty: CancellationDifficulty
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)


class ParseResponse(StrictModel):
    id: UUID
    input_type: RawInputType
    status: ParseStatus
    prompt_version: str
    storage_path: str | None
    extracted: ExtractedReceipt | None
    validation_errors: list[dict[str, Any]] | None
    created_at: datetime


class ConfirmParseRequest(StrictModel):
    extracted: ExtractedReceipt
    creature_name: str = Field(default="Nova", min_length=1, max_length=80)
    creature_species: str = Field(default="blob", min_length=1, max_length=40)


class NotificationPreferencesResponse(StrictModel):
    reminder_days_before: list[int]
    push_enabled: bool
    email_enabled: bool


class NotificationPreferencesUpdate(StrictModel):
    reminder_days_before: list[int] | None = None
    push_enabled: bool | None = None
    email_enabled: bool | None = None

    @field_validator("reminder_days_before")
    @classmethod
    def validate_days(cls, value: list[int] | None) -> list[int] | None:
        if value is not None and (not value or any(day < 0 or day > 365 for day in value)):
            raise ValueError("reminder days must contain values from 0 through 365")
        return sorted(set(value), reverse=True) if value else value


class WidgetTokenResponse(StrictModel):
    token: str
    expires_at: datetime


class WidgetSummary(StrictModel):
    active_count: int
    needs_attention_count: int
    monthly_cost: Decimal
    annual_cost: Decimal
    next_item: SubscriptionResponse | None
    generated_at: datetime


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    version: str


class ReadinessResponse(StrictModel):
    status: Literal["ready"] = "ready"
    database: Literal["ok"] = "ok"


class MeResponse(StrictModel):
    user_id: UUID
    clerk_user_id: str
    session_id: str | None = None
    claims: dict[str, Any] = Field(default_factory=dict)
