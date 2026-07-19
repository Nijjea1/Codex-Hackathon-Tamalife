from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
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


@dataclass(frozen=True)
class HealthState:
    days_remaining: int | None
    health_score: int
    mood: str
    needs_attention: bool
    reason: str


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def calculate_health(
    subscription: Subscription,
    events: list[SubscriptionEvent] | None = None,
    *,
    today: date | None = None,
) -> HealthState:
    today = today or datetime.now(UTC).date()
    events = events if events is not None else list(subscription.events)
    latest_risk = max(
        (
            _as_utc(event.occurred_at)
            for event in events
            if event.event_type == EventType.price_hike_detected
        ),
        default=None,
    )
    latest_resolution = max(
        (_as_utc(event.occurred_at) for event in events if event.event_type in RESOLUTION_EVENTS),
        default=None,
    )

    if subscription.status in {SubscriptionStatus.canceled, SubscriptionStatus.disputed} or (
        latest_resolution is not None and (latest_risk is None or latest_resolution >= latest_risk)
    ):
        return HealthState(None, 100, "resolved", False, "The latest action resolved this item.")

    if subscription.renewal_or_expiry_date is None:
        return HealthState(None, 70, "healthy", False, "No renewal or expiry date is set.")

    days = (subscription.renewal_or_expiry_date - today).days
    if days <= 0:
        return HealthState(days, 8, "critical", True, "The renewal or expiry date is due.")
    if days <= 3:
        return HealthState(days, 25, "sick", True, "The renewal or expiry date is imminent.")
    if days <= 12:
        return HealthState(
            days, 51, "concerned", True, "The renewal or expiry date is approaching."
        )
    if days <= 25:
        return HealthState(days, 76, "healthy", False, "The item is within the next month.")
    return HealthState(days, 94, "happy", False, "No action is needed soon.")


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
