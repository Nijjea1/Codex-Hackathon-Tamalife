from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, utcnow


class ItemType(str, enum.Enum):
    subscription = "subscription"
    bill = "bill"
    warranty = "warranty"


class BillingCycle(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"
    one_time = "one_time"
    trial = "trial"


class CancellationDifficulty(str, enum.Enum):
    easy = "easy"
    moderate = "moderate"
    hard = "hard"
    unknown = "unknown"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    canceled = "canceled"
    disputed = "disputed"


class EventType(str, enum.Enum):
    price_hike_detected = "price_hike_detected"
    resolved_renew = "resolved_renew"
    resolved_cancel = "resolved_cancel"
    resolved_dispute = "resolved_dispute"
    resolved_keep = "resolved_keep"
    reminder_sent = "reminder_sent"


class RawInputType(str, enum.Enum):
    text = "text"
    image = "image"
    document = "document"


class ParseStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    needs_review = "needs_review"
    failed = "failed"
    confirmed = "confirmed"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    clerk_user_id: Mapped[str | None] = mapped_column(String(200), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(200))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    subscriptions: Mapped[list[Subscription]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (Index("ix_subscriptions_user_date", "user_id", "renewal_or_expiry_date"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    item_type: Mapped[ItemType] = mapped_column(Enum(ItemType), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="Other")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    previous_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle), nullable=False)
    renewal_or_expiry_date: Mapped[date | None] = mapped_column(Date, index=True)
    cancellation_difficulty: Mapped[CancellationDifficulty] = mapped_column(
        Enum(CancellationDifficulty), nullable=False, default=CancellationDifficulty.unknown
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.active
    )
    creature_name: Mapped[str] = mapped_column(String(80), nullable=False, default="Nova")
    creature_species: Mapped[str] = mapped_column(String(40), nullable=False, default="blob")
    notes: Mapped[str | None] = mapped_column(Text)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    user: Mapped[User] = relationship(back_populates="subscriptions")
    events: Mapped[list[SubscriptionEvent]] = relationship(
        back_populates="subscription",
        cascade="all, delete-orphan",
        order_by="SubscriptionEvent.occurred_at",
    )


class SubscriptionEvent(Base):
    __tablename__ = "subscription_events"
    __table_args__ = (
        Index("ix_subscription_events_subscription_time", "subscription_id", "occurred_at"),
        UniqueConstraint("subscription_id", "idempotency_key"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    idempotency_key: Mapped[str | None] = mapped_column(String(200))

    subscription: Mapped[Subscription] = relationship(back_populates="events")


class ParsedReceipt(TimestampMixin, Base):
    __tablename__ = "parsed_receipts"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), index=True
    )
    raw_input_type: Mapped[RawInputType] = mapped_column(Enum(RawInputType), nullable=False)
    raw_text: Mapped[str | None] = mapped_column(Text)
    storage_path: Mapped[str | None] = mapped_column(String(500))
    extracted_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    raw_model_response: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(Float)
    status: Mapped[ParseStatus] = mapped_column(
        Enum(ParseStatus), nullable=False, default=ParseStatus.pending
    )
    prompt_version: Mapped[str] = mapped_column(String(80), nullable=False)
    validation_errors: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NotificationPreference(TimestampMixin, Base):
    __tablename__ = "notification_preferences"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    reminder_days_before: Mapped[list[int]] = mapped_column(JSON, default=lambda: [14, 7, 1])
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class WidgetToken(Base):
    __tablename__ = "widget_tokens"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IdempotencyKey(TimestampMixin, Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "scope", "key", name="uq_idempotency_keys_user_scope_key"),
        Index("ix_idempotency_keys_expires_at", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scope: Mapped[str] = mapped_column(String(120), nullable=False)
    key: Mapped[str] = mapped_column(String(200), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[int | None] = mapped_column(Integer)
    response_body: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ClerkWebhookEvent(TimestampMixin, Base):
    __tablename__ = "clerk_webhook_events"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    clerk_event_id: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processing_error: Mapped[str | None] = mapped_column(Text)
