from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, tzinfo
from decimal import Decimal

from tamalife_backend.db.models import (
    BillingCycle,
    EventType,
    Subscription,
    SubscriptionEvent,
    SubscriptionStatus,
)

RESOLUTION_EVENTS = {
    EventType.resolved_renew,
    EventType.resolved_cancel,
    EventType.resolved_dispute,
    EventType.resolved_keep,
}

RESOLUTION_STATUSES = {
    EventType.resolved_renew: SubscriptionStatus.active,
    EventType.resolved_cancel: SubscriptionStatus.canceled,
    EventType.resolved_dispute: SubscriptionStatus.disputed,
    EventType.resolved_keep: SubscriptionStatus.active,
}


@dataclass(frozen=True)
class HealthState:
    days_remaining: int | None
    health_score: int
    mood: str
    needs_attention: bool
    reason: str


@dataclass(frozen=True)
class ResolutionEffect:
    resolved: bool
    status: SubscriptionStatus
    latest_event_type: EventType | None


@dataclass(frozen=True)
class PriceIncrease:
    detected: bool
    previous_amount: Decimal | None
    current_amount: Decimal
    difference: Decimal
    percentage: Decimal | None


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)


def _date_at(value: date | datetime, timezone: tzinfo) -> date:
    if isinstance(value, datetime):
        localized = value if value.tzinfo else value.replace(tzinfo=UTC)
        return localized.astimezone(timezone).date()
    return value


def days_remaining(
    target_date: date,
    *,
    now: date | datetime,
    timezone: tzinfo = UTC,
) -> int:
    """Return calendar days until a date in the requested time zone."""
    return (target_date - _date_at(now, timezone)).days


def health_score(days: int, *, resolved: bool = False) -> int:
    if resolved:
        return 100
    if days <= 0:
        return 8
    if days <= 3:
        return 25
    if days <= 12:
        return 51
    if days <= 25:
        return 76
    return 94


def creature_mood(days: int, *, resolved: bool = False) -> str:
    if resolved:
        return "resolved"
    if days <= 0:
        return "critical"
    if days <= 3:
        return "sick"
    if days <= 12:
        return "concerned"
    if days <= 25:
        return "healthy"
    return "happy"


def resolution_event_effects(
    events: Iterable[SubscriptionEvent],
    *,
    current_status: SubscriptionStatus,
) -> ResolutionEffect:
    """Apply the latest stored resolution only when no newer risk supersedes it."""
    latest_risk: datetime | None = None
    latest_resolution: tuple[datetime, EventType] | None = None
    for event in events:
        if event.occurred_at is None:
            continue
        occurred_at = _as_utc(event.occurred_at)
        if event.event_type == EventType.price_hike_detected and (
            latest_risk is None or occurred_at > latest_risk
        ):
            latest_risk = occurred_at
        if event.event_type in RESOLUTION_EVENTS and (
            latest_resolution is None or occurred_at > latest_resolution[0]
        ):
            latest_resolution = (occurred_at, event.event_type)

    if current_status in {SubscriptionStatus.canceled, SubscriptionStatus.disputed}:
        return ResolutionEffect(
            True, current_status, latest_resolution[1] if latest_resolution else None
        )
    if latest_resolution is None or (
        latest_risk is not None and latest_resolution[0] < latest_risk
    ):
        return ResolutionEffect(False, current_status, None)
    event_type = latest_resolution[1]
    return ResolutionEffect(True, RESOLUTION_STATUSES[event_type], event_type)


def detect_price_increase(
    previous_amount: Decimal | None,
    current_amount: Decimal,
) -> PriceIncrease:
    difference = (
        current_amount - previous_amount if previous_amount is not None else Decimal("0")
    ).quantize(Decimal("0.01"))
    detected = previous_amount is not None and difference > 0
    percentage = None
    if detected and previous_amount is not None and previous_amount > 0:
        percentage = ((difference / previous_amount) * Decimal("100")).quantize(Decimal("0.01"))
    return PriceIncrease(detected, previous_amount, current_amount, difference, percentage)


def matching_reminder_threshold(
    target_date: date,
    thresholds: Iterable[int],
    *,
    now: date | datetime,
    timezone: tzinfo = UTC,
) -> int | None:
    remaining = days_remaining(target_date, now=now, timezone=timezone)
    valid_thresholds = {threshold for threshold in thresholds if threshold >= 0}
    return remaining if remaining in valid_thresholds else None


def calculate_health(
    subscription: Subscription,
    events: list[SubscriptionEvent] | None = None,
    *,
    today: date | None = None,
    now: datetime | None = None,
) -> HealthState:
    reference: date | datetime = today or now or datetime.now(UTC)
    stored_events = events if events is not None else list(subscription.events)
    effect = resolution_event_effects(
        stored_events,
        current_status=subscription.status or SubscriptionStatus.active,
    )
    if effect.resolved:
        return HealthState(None, 100, "resolved", False, "The latest action resolved this item.")

    target_date = subscription.renewal_or_expiry_date
    if target_date is None:
        return HealthState(None, 70, "healthy", False, "No renewal or expiry date is set.")

    remaining = days_remaining(target_date, now=reference)
    score = health_score(remaining)
    mood = creature_mood(remaining)
    reasons = {
        "critical": "The renewal or expiry date is due.",
        "sick": "The renewal or expiry date is imminent.",
        "concerned": "The renewal or expiry date is approaching.",
        "healthy": "The item is within the next month.",
        "happy": "No action is needed soon.",
    }
    return HealthState(remaining, score, mood, remaining <= 12, reasons[mood])


def annualized_amount(amount: Decimal, cycle: BillingCycle) -> Decimal:
    factors = {
        BillingCycle.weekly: Decimal("52"),
        BillingCycle.monthly: Decimal("12"),
        BillingCycle.yearly: Decimal("1"),
        BillingCycle.one_time: Decimal("0"),
        BillingCycle.trial: Decimal("0"),
    }
    return (amount * factors[cycle]).quantize(Decimal("0.01"))


def monthly_amount(amount: Decimal, cycle: BillingCycle) -> Decimal:
    return (annualized_amount(amount, cycle) / Decimal("12")).quantize(Decimal("0.01"))
