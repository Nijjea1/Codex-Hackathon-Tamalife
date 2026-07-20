from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
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


class NotificationChannel(str, enum.Enum):
    push = "push"
    email = "email"


class ReminderDeliveryStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    retrying = "retrying"
    delivered = "delivered"
    canceled = "canceled"
    dead_letter = "dead_letter"


class SourceType(str, enum.Enum):
    pricing = "pricing"
    plans = "plans"
    promotion = "promotion"
    features = "features"
    help = "help"
    student = "student"
    family = "family"
    annual_discount = "annual_discount"
    regional_pricing = "regional_pricing"
    alternatives_evidence = "alternatives_evidence"


class DiscoveryStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cost_limited = "cost_limited"


class CandidateStatus(str, enum.Enum):
    discovered = "discovered"
    validating = "validating"
    verified = "verified"
    active = "active"
    rejected = "rejected"
    needs_review = "needs_review"
    superseded = "superseded"


class ReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    auto_approved = "auto_approved"


class SourceStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    failing = "failing"
    blocked = "blocked"
    superseded = "superseded"


class PriceChangeType(str, enum.Enum):
    initial = "initial"
    increase = "increase"
    decrease = "decrease"
    unchanged = "unchanged"


class MatchStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"
    unmatched = "unmatched"


class RecommendationStatus(str, enum.Enum):
    active = "active"
    seen = "seen"
    dismissed = "dismissed"
    accepted = "accepted"
    expired = "expired"


class AlertDeliveryStatus(str, enum.Enum):
    pending = "pending"
    delivered = "delivered"
    failed = "failed"
    read = "read"


class SourceFetchStatus(str, enum.Enum):
    pending = "pending"
    not_modified = "not_modified"
    fetched = "fetched"
    extracted = "extracted"
    failed = "failed"
    rejected = "rejected"


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


class ReminderDelivery(TimestampMixin, Base):
    __tablename__ = "reminder_deliveries"
    __table_args__ = (
        UniqueConstraint(
            "subscription_id",
            "channel",
            "scheduled_for",
            "threshold_days",
            name="uq_reminder_delivery_schedule",
        ),
        CheckConstraint("threshold_days >= 0", name="reminder_threshold_nonnegative"),
        CheckConstraint("attempt_count >= 0", name="reminder_attempt_count_nonnegative"),
        CheckConstraint("max_attempts > 0", name="reminder_max_attempts_positive"),
        Index("ix_reminder_deliveries_due", "status", "next_attempt_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel"), nullable=False
    )
    scheduled_for: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    threshold_days: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ReminderDeliveryStatus] = mapped_column(
        Enum(ReminderDeliveryStatus, name="reminder_delivery_status"),
        nullable=False,
        default=ReminderDeliveryStatus.pending,
    )
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    provider_message_id: Mapped[str | None] = mapped_column(String(300))
    request_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)


class WidgetToken(Base):
    __tablename__ = "widget_tokens"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    scope: Mapped[str] = mapped_column(String(40), nullable=False, default="widget:read")
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


class Provider(TimestampMixin, Base):
    __tablename__ = "providers"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    official_domain: Mapped[str | None] = mapped_column(String(255), unique=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="Other")
    logo_url: Mapped[str | None] = mapped_column(String(1000))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    policy_status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending")
    last_discovered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProviderAlias(TimestampMixin, Base):
    __tablename__ = "provider_aliases"
    __table_args__ = (UniqueConstraint("provider_id", "normalized_alias"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alias: Mapped[str] = mapped_column(String(240), nullable=False)
    normalized_alias: Mapped[str] = mapped_column(String(240), nullable=False, index=True)
    match_priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class SourceDiscoveryRun(TimestampMixin, Base):
    __tablename__ = "source_discovery_runs"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_source_discovery_run_idempotency"),
        Index("ix_source_discovery_runs_status_created", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id", ondelete="SET NULL"), index=True
    )
    run_type: Mapped[str] = mapped_column(String(30), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    query_shard: Mapped[str] = mapped_column(String(120), nullable=False, default="default")
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(80), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DiscoveryStatus] = mapped_column(
        Enum(DiscoveryStatus, name="discovery_status"),
        nullable=False,
        default=DiscoveryStatus.pending,
    )
    openai_response_id: Mapped[str | None] = mapped_column(String(200))
    candidate_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    search_call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_micros: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    request_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(Text)


class SourceCandidate(TimestampMixin, Base):
    __tablename__ = "source_candidates"
    __table_args__ = (
        UniqueConstraint("normalized_url_hash", "country", "source_type"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="candidate_confidence_range"),
        Index("ix_source_candidates_review", "status", "confidence"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    discovery_run_id: Mapped[UUID] = mapped_column(
        ForeignKey("source_discovery_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id", ondelete="SET NULL"), index=True
    )
    original_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    normalized_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    normalized_url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    candidate_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, name="source_type"), nullable=False
    )
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3))
    language: Mapped[str] = mapped_column(String(12), nullable=False, default="en")
    page_title: Mapped[str | None] = mapped_column(String(500))
    first_party: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    deterministic_score: Mapped[float | None] = mapped_column(Float)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[CandidateStatus] = mapped_column(
        Enum(CandidateStatus, name="candidate_status"),
        nullable=False,
        default=CandidateStatus.discovered,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activated_source_id: Mapped[UUID | None] = mapped_column(Uuid)


class DiscoveryEvidence(TimestampMixin, Base):
    __tablename__ = "discovery_evidence"
    __table_args__ = (UniqueConstraint("candidate_id", "url"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    candidate_id: Mapped[UUID] = mapped_column(
        ForeignKey("source_candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500))
    evidence_type: Mapped[str] = mapped_column(String(40), nullable=False, default="web_search")
    citation_index: Mapped[int | None] = mapped_column(Integer)
    content_hash: Mapped[str | None] = mapped_column(String(64))


class PricingSource(TimestampMixin, Base):
    __tablename__ = "pricing_sources"
    __table_args__ = (
        UniqueConstraint("normalized_url_hash", "country", "language"),
        Index("ix_pricing_sources_due", "status", "next_check_at"),
        CheckConstraint("consecutive_failures >= 0", name="source_failure_count_nonnegative"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    discovery_candidate_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("source_candidates.id", ondelete="SET NULL"), index=True
    )
    canonical_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    normalized_url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, name="pricing_source_type"), nullable=False
    )
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3))
    language: Mapped[str] = mapped_column(String(12), nullable=False, default="en")
    status: Mapped[SourceStatus] = mapped_column(
        Enum(SourceStatus, name="source_status"), nullable=False, default=SourceStatus.active
    )
    check_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=259200)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_check_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )
    etag: Mapped[str | None] = mapped_column(String(500))
    last_modified: Mapped[str | None] = mapped_column(String(200))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    semantic_hash: Mapped[str | None] = mapped_column(String(64))
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lease_token: Mapped[str | None] = mapped_column(String(100))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    superseded_source_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("pricing_sources.id", ondelete="SET NULL")
    )
    first_discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    last_rediscovered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discovery_confidence: Mapped[float | None] = mapped_column(Float)
    prompt_version: Mapped[str | None] = mapped_column(String(80))


class ProviderPlan(TimestampMixin, Base):
    __tablename__ = "provider_plans"
    __table_args__ = (
        UniqueConstraint("provider_id", "external_key", "country", "currency", "billing_cycle"),
        CheckConstraint("current_price >= 0", name="provider_plan_price_nonnegative"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("pricing_sources.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    external_key: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        Enum(BillingCycle, name="provider_plan_billing_cycle"), nullable=False
    )
    current_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    monthly_equivalent: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    trial_days: Mapped[int | None] = mapped_column(Integer)
    features: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    first_observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    last_observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )


class PlanPriceHistory(TimestampMixin, Base):
    __tablename__ = "plan_price_history"
    __table_args__ = (
        UniqueConstraint("plan_id", "evidence_hash"),
        CheckConstraint("price >= 0", name="price_history_price_nonnegative"),
        Index("ix_plan_price_history_plan_observed", "plan_id", "observed_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("provider_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_fetch_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("source_fetches.id", ondelete="SET NULL"), index=True
    )
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    promotional_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    previous_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    change_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    change_percentage: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    change_type: Mapped[PriceChangeType] = mapped_column(
        Enum(PriceChangeType, name="price_change_type"), nullable=False
    )
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="price_review_status"),
        nullable=False,
        default=ReviewStatus.pending,
    )
    evidence_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class Deal(TimestampMixin, Base):
    __tablename__ = "deals"
    __table_args__ = (
        UniqueConstraint("provider_id", "source_id", "fingerprint"),
        Index("ix_deals_active_expiry", "active", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("provider_plans.id", ondelete="CASCADE"), index=True
    )
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("pricing_sources.id", ondelete="RESTRICT"), nullable=False
    )
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    regular_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    promotional_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str | None] = mapped_column(String(3))
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    eligibility: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    source_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="deal_review_status"),
        nullable=False,
        default=ReviewStatus.pending,
    )


class PlanAlternative(TimestampMixin, Base):
    __tablename__ = "plan_alternatives"
    __table_args__ = (UniqueConstraint("source_plan_id", "alternative_plan_id", "country"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    source_plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("provider_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alternative_plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("provider_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    feature_similarity: Mapped[float] = mapped_column(Float, nullable=False)
    monthly_savings: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    annual_savings: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    switching_effort: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reason_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )


class UserPlanMatch(TimestampMixin, Base):
    __tablename__ = "user_plan_matches"
    __table_args__ = (
        UniqueConstraint("subscription_id", "provider_plan_id"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="match_confidence_range"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    provider_plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("provider_plans.id", ondelete="CASCADE"), nullable=False
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String(40), nullable=False)
    reason_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="match_status"), nullable=False, default=MatchStatus.pending
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserRecommendation(TimestampMixin, Base):
    __tablename__ = "user_recommendations"
    __table_args__ = (
        UniqueConstraint("user_id", "subscription_id", "deduplication_key"),
        Index("ix_user_recommendations_active", "user_id", "status", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recommendation_type: Mapped[str] = mapped_column(String(60), nullable=False)
    target_plan_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("provider_plans.id", ondelete="SET NULL")
    )
    deal_id: Mapped[UUID | None] = mapped_column(ForeignKey("deals.id", ondelete="SET NULL"))
    deduplication_key: Mapped[str] = mapped_column(String(200), nullable=False)
    estimated_monthly_savings: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    estimated_annual_savings: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    reason_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    generator_version: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[RecommendationStatus] = mapped_column(
        Enum(RecommendationStatus, name="recommendation_status"),
        nullable=False,
        default=RecommendationStatus.active,
    )
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    feedback: Mapped[str | None] = mapped_column(String(40))
    feedback_reason: Mapped[str | None] = mapped_column(String(500))


class PriceIntelligenceAlert(TimestampMixin, Base):
    __tablename__ = "price_intelligence_alerts"
    __table_args__ = (
        UniqueConstraint("user_id", "deduplication_key"),
        Index("ix_price_alerts_delivery", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recommendation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user_recommendations.id", ondelete="CASCADE")
    )
    price_history_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("plan_price_history.id", ondelete="CASCADE")
    )
    deal_id: Mapped[UUID | None] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"))
    alert_type: Mapped[str] = mapped_column(String(60), nullable=False)
    deduplication_key: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[AlertDeliveryStatus] = mapped_column(
        Enum(AlertDeliveryStatus, name="price_alert_delivery_status"),
        nullable=False,
        default=AlertDeliveryStatus.pending,
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    request_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)


class SourceFetch(TimestampMixin, Base):
    __tablename__ = "source_fetches"
    __table_args__ = (
        UniqueConstraint("source_id", "content_hash"),
        Index("ix_source_fetches_status_created", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("pricing_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    request_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[SourceFetchStatus] = mapped_column(
        Enum(SourceFetchStatus, name="source_fetch_status"),
        nullable=False,
        default=SourceFetchStatus.pending,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    http_status: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    content_type: Mapped[str | None] = mapped_column(String(200))
    byte_count: Mapped[int | None] = mapped_column(Integer)
    content_hash: Mapped[str | None] = mapped_column(String(64))
    semantic_hash: Mapped[str | None] = mapped_column(String(64))
    changed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    extraction_strategy: Mapped[str | None] = mapped_column(String(80))
    extraction_version: Mapped[str | None] = mapped_column(String(80))
    confidence: Mapped[float | None] = mapped_column(Float)
    raw_storage_path: Mapped[str | None] = mapped_column(String(1000))
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sanitized_error: Mapped[str | None] = mapped_column(Text)
