from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta, tzinfo
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

# --- Decay engine tuning ---------------------------------------------------
# A freshly added item is thriving for this long regardless of its renewal
# date, so we never punish the user for something they just told us about.
GRACE_PERIOD = timedelta(hours=24)
# Ordering of the five moods from best to worst, used to take the "worse of"
# two signals (day-based decay vs. an unresolved risk flag).
_MOOD_SEVERITY = {"happy": 0, "healthy": 1, "concerned": 2, "sick": 3, "critical": 4}
# Days-remaining values at which the day-based mood worsens by one step.
_MOOD_THRESHOLDS = (25, 12, 3, 0)
# An unresolved price hike can never leave an item better than "concerned":
# a far-from-renewal item with a hike therefore decays faster than a clean one,
# while an item that is already sick/critical is left untouched.
PRICE_HIKE_FLOOR_MOOD = "concerned"
PRICE_HIKE_FLOOR_SCORE = 51


def _worse_mood(left: str, right: str) -> str:
    return left if _MOOD_SEVERITY[left] >= _MOOD_SEVERITY[right] else right


@dataclass(frozen=True)
class HealthState:
    days_remaining: int | None
    health_score: int
    mood: str
    needs_attention: bool
    reason: str
    # Exact instant the mood will next cross a state boundary with no user
    # action. Drives the iOS widget's timeline reloads. None if nothing will
    # change (resolved, no date, or already critical).
    next_transition_at: datetime | None = None
    # A price increase that has not yet been resolved is currently degrading
    # this item's health.
    price_hike_detected: bool = False


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


def has_unresolved_price_hike(
    events: Iterable[SubscriptionEvent],
    *,
    current_status: SubscriptionStatus,
) -> bool:
    """A recorded price hike that no later resolution (or terminal status) clears."""
    if current_status in {SubscriptionStatus.canceled, SubscriptionStatus.disputed}:
        return False
    latest_risk: datetime | None = None
    latest_resolution: datetime | None = None
    for event in events:
        if event.occurred_at is None:
            continue
        occurred_at = _as_utc(event.occurred_at)
        if event.event_type == EventType.price_hike_detected:
            if latest_risk is None or occurred_at > latest_risk:
                latest_risk = occurred_at
        elif event.event_type in RESOLUTION_EVENTS:
            if latest_resolution is None or occurred_at > latest_resolution:
                latest_resolution = occurred_at
    if latest_risk is None:
        return False
    return latest_resolution is None or latest_resolution < latest_risk


def _midnight(target_date: date, offset_days: int, timezone: tzinfo) -> datetime:
    """Start of the day the item will have ``offset_days`` remaining."""
    return datetime.combine(target_date - timedelta(days=offset_days), time.min, tzinfo=timezone)


def _next_transition_at(
    target_date: date,
    remaining: int,
    *,
    current_mood: str,
    floor_mood: str | None,
    timezone: tzinfo,
) -> datetime | None:
    """The next instant the mood changes as ``remaining`` decreases, or None."""
    for threshold in _MOOD_THRESHOLDS:
        if threshold >= remaining:
            continue
        mood_at = creature_mood(threshold)
        if floor_mood is not None:
            mood_at = _worse_mood(mood_at, floor_mood)
        if mood_at != current_mood:
            return _midnight(target_date, threshold, timezone)
    return None


def calculate_health(
    subscription: Subscription,
    events: list[SubscriptionEvent] | None = None,
    *,
    today: date | None = None,
    now: datetime | None = None,
    timezone: tzinfo = UTC,
) -> HealthState:
    reference: date | datetime = today or now or datetime.now(UTC)
    reference_now: datetime = now or (
        datetime.combine(today, time.min, tzinfo=UTC) if today else datetime.now(UTC)
    )
    stored_events = events if events is not None else list(subscription.events)
    status = subscription.status or SubscriptionStatus.active
    effect = resolution_event_effects(stored_events, current_status=status)
    if effect.resolved:
        return HealthState(
            None,
            100,
            "resolved",
            False,
            "The latest action resolved this item.",
            next_transition_at=None,
            price_hike_detected=False,
        )

    hike = has_unresolved_price_hike(stored_events, current_status=status)
    floor_mood = PRICE_HIKE_FLOOR_MOOD if hike else None

    target_date = subscription.renewal_or_expiry_date
    if target_date is None:
        mood = _worse_mood("healthy", floor_mood) if floor_mood else "healthy"
        score = min(70, PRICE_HIKE_FLOOR_SCORE) if hike else 70
        needs_attention = _MOOD_SEVERITY[mood] >= _MOOD_SEVERITY["concerned"]
        reason = (
            "An unresolved price increase needs a look."
            if hike
            else "No renewal or expiry date is set."
        )
        return HealthState(
            None,
            score,
            mood,
            needs_attention,
            reason,
            next_transition_at=None,
            price_hike_detected=hike,
        )

    remaining = days_remaining(target_date, now=reference, timezone=timezone)

    # Grace period: a just-added item is thriving no matter how close renewal is.
    created_at = getattr(subscription, "created_at", None)
    if created_at is not None:
        grace_expiry = _as_utc(created_at) + GRACE_PERIOD
        if reference_now < grace_expiry:
            post_grace_mood = creature_mood(remaining)
            if floor_mood:
                post_grace_mood = _worse_mood(post_grace_mood, floor_mood)
            next_at = (
                grace_expiry
                if post_grace_mood != "happy"
                else _next_transition_at(
                    target_date,
                    remaining,
                    current_mood="happy",
                    floor_mood=floor_mood,
                    timezone=timezone,
                )
            )
            return HealthState(
                remaining,
                94,
                "happy",
                False,
                "Just added — settling into the garden.",
                next_transition_at=next_at,
                price_hike_detected=hike,
            )

    day_mood = creature_mood(remaining)
    day_score = health_score(remaining)
    mood = _worse_mood(day_mood, floor_mood) if floor_mood else day_mood
    score = min(day_score, PRICE_HIKE_FLOOR_SCORE) if hike else day_score
    needs_attention = _MOOD_SEVERITY[mood] >= _MOOD_SEVERITY["concerned"]
    reasons = {
        "critical": "The renewal or expiry date is due.",
        "sick": "The renewal or expiry date is imminent.",
        "concerned": "The renewal or expiry date is approaching.",
        "healthy": "The item is within the next month.",
        "happy": "No action is needed soon.",
    }
    reason = (
        "An unresolved price increase is ageing this item."
        if hike and mood != day_mood
        else reasons[mood]
    )
    next_at = _next_transition_at(
        target_date,
        remaining,
        current_mood=mood,
        floor_mood=floor_mood,
        timezone=timezone,
    )
    return HealthState(
        remaining,
        score,
        mood,
        needs_attention,
        reason,
        next_transition_at=next_at,
        price_hike_detected=hike,
    )


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
