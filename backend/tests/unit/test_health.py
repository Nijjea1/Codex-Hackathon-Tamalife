from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from tamalife_backend.db.models import (
    BillingCycle,
    EventType,
    ItemType,
    Subscription,
    SubscriptionEvent,
    SubscriptionStatus,
)
from tamalife_backend.domain.health import (
    annualized_amount,
    calculate_health,
    creature_mood,
    days_remaining,
    detect_price_increase,
    has_unresolved_price_hike,
    health_score,
    matching_reminder_threshold,
    monthly_amount,
    resolution_event_effects,
)

TODAY = date(2026, 7, 18)


def item(
    days: int,
    *,
    item_type: ItemType = ItemType.subscription,
    billing_cycle: BillingCycle = BillingCycle.monthly,
    status: SubscriptionStatus = SubscriptionStatus.active,
) -> Subscription:
    return Subscription(
        id=uuid4(),
        user_id=uuid4(),
        vendor_name="Vendor",
        display_name="Item",
        item_type=item_type,
        category="Other",
        amount=Decimal("10"),
        currency="USD",
        billing_cycle=billing_cycle,
        renewal_or_expiry_date=TODAY + timedelta(days=days),
        status=status,
        creature_name="Nova",
        creature_species="blob",
    )


@pytest.mark.parametrize(
    ("days", "mood", "score", "needs_attention"),
    [
        (-1, "critical", 8, True),
        (0, "critical", 8, True),
        (1, "sick", 25, True),
        (3, "sick", 25, True),
        (12, "concerned", 51, True),
        (25, "healthy", 76, False),
        (26, "happy", 94, False),
    ],
)
def test_health_boundaries(days: int, mood: str, score: int, needs_attention: bool) -> None:
    health = calculate_health(item(days), [], today=TODAY)
    assert health.days_remaining == days
    assert health.mood == mood
    assert health.health_score == score
    assert health.needs_attention is needs_attention
    assert creature_mood(days) == mood
    assert health_score(days) == score


@pytest.mark.parametrize(
    ("item_type", "cycle"),
    [
        (ItemType.subscription, BillingCycle.trial),
        (ItemType.warranty, BillingCycle.one_time),
    ],
)
def test_trials_and_warranties_use_their_expiry_date(
    item_type: ItemType, cycle: BillingCycle
) -> None:
    subscription = item(1, item_type=item_type, billing_cycle=cycle)
    assert calculate_health(subscription, [], today=TODAY).mood == "sick"
    assert monthly_amount(subscription.amount, cycle) == Decimal("0.00")
    assert annualized_amount(subscription.amount, cycle) == Decimal("0.00")


def test_resolution_after_risk_clears_attention() -> None:
    subscription = item(1)
    risk = SubscriptionEvent(
        subscription_id=subscription.id,
        event_type=EventType.price_hike_detected,
        occurred_at=datetime(2026, 7, 17, tzinfo=UTC),
    )
    renewal = SubscriptionEvent(
        subscription_id=subscription.id,
        event_type=EventType.resolved_renew,
        occurred_at=datetime(2026, 7, 18, tzinfo=UTC),
    )
    effect = resolution_event_effects([risk, renewal], current_status=subscription.status)
    health = calculate_health(subscription, [risk, renewal], today=TODAY)
    assert effect.resolved
    assert effect.status == SubscriptionStatus.active
    assert effect.latest_event_type == EventType.resolved_renew
    assert health.mood == "resolved"
    assert health.health_score == 100
    assert not health.needs_attention


def test_new_risk_after_resolution_requires_attention_again() -> None:
    subscription = item(1)
    resolution = SubscriptionEvent(
        subscription_id=subscription.id,
        event_type=EventType.resolved_keep,
        occurred_at=datetime(2026, 7, 17, tzinfo=UTC),
    )
    risk = SubscriptionEvent(
        subscription_id=subscription.id,
        event_type=EventType.price_hike_detected,
        occurred_at=datetime(2026, 7, 18, tzinfo=UTC),
    )
    assert calculate_health(subscription, [resolution, risk], today=TODAY).mood == "sick"


def test_canceled_item_is_resolved_without_an_event() -> None:
    health = calculate_health(item(1, status=SubscriptionStatus.canceled), [], today=TODAY)
    assert health.mood == "resolved"
    assert not health.needs_attention


def test_cost_normalization() -> None:
    assert annualized_amount(Decimal("10"), BillingCycle.weekly) == Decimal("520.00")
    assert annualized_amount(Decimal("10"), BillingCycle.monthly) == Decimal("120.00")
    assert monthly_amount(Decimal("120"), BillingCycle.yearly) == Decimal("10.00")
    assert annualized_amount(Decimal("50"), BillingCycle.one_time) == Decimal("0.00")


def test_price_increase_detection() -> None:
    increase = detect_price_increase(Decimal("8.00"), Decimal("10.00"))
    assert increase.detected
    assert increase.difference == Decimal("2.00")
    assert increase.percentage == Decimal("25.00")
    assert not detect_price_increase(None, Decimal("10.00")).detected
    assert not detect_price_increase(Decimal("10.00"), Decimal("10.00")).detected


def test_reminder_thresholds() -> None:
    assert matching_reminder_threshold(TODAY + timedelta(days=3), [25, 12, 3], now=TODAY) == 3
    assert matching_reminder_threshold(TODAY + timedelta(days=4), [25, 12, 3], now=TODAY) is None


def test_timezone_rollover_is_deterministic() -> None:
    instant = datetime(2026, 7, 19, 1, 30, tzinfo=UTC)
    eastern = timezone(timedelta(hours=-4))
    assert days_remaining(date(2026, 7, 19), now=instant, timezone=UTC) == 0
    assert days_remaining(date(2026, 7, 19), now=instant, timezone=eastern) == 1


def test_leap_year_boundary() -> None:
    assert days_remaining(date(2028, 3, 1), now=date(2028, 2, 28)) == 2
    assert days_remaining(date(2027, 3, 1), now=date(2027, 2, 28)) == 1


# --- Decay engine: grace period, price-hike acceleration, transitions -------

NOON = datetime(2026, 7, 18, 12, 0, tzinfo=UTC)


def hike_event(sub: Subscription, *, at: datetime) -> SubscriptionEvent:
    return SubscriptionEvent(
        subscription_id=sub.id, event_type=EventType.price_hike_detected, occurred_at=at
    )


def resolve_event(sub: Subscription, *, at: datetime) -> SubscriptionEvent:
    return SubscriptionEvent(
        subscription_id=sub.id, event_type=EventType.resolved_keep, occurred_at=at
    )


def test_just_added_item_is_thriving_during_grace() -> None:
    # Renewal is imminent (1 day out) but the item was added moments ago.
    sub = item(1)
    sub.created_at = NOON - timedelta(minutes=5)
    health = calculate_health(sub, [], now=NOON)
    assert health.mood == "happy"
    assert health.health_score == 94
    assert not health.needs_attention


def test_grace_expires_after_24h() -> None:
    sub = item(1)
    sub.created_at = NOON - timedelta(hours=30)
    health = calculate_health(sub, [], now=NOON)
    assert health.mood == "sick"  # falls back to the day-based mood


def test_unresolved_price_hike_ages_a_far_item() -> None:
    # 40 days out would normally be "happy"; an unresolved hike floors it.
    sub = item(40)
    health = calculate_health(sub, [hike_event(sub, at=NOON)], today=TODAY)
    assert health.mood == "concerned"
    assert health.needs_attention
    assert health.price_hike_detected
    # A clean item at the same distance stays happy and calm.
    assert calculate_health(item(40), [], today=TODAY).mood == "happy"


def test_price_hike_never_improves_a_near_item() -> None:
    sub = item(1)  # already "sick"
    health = calculate_health(sub, [hike_event(sub, at=NOON)], today=TODAY)
    assert health.mood == "sick"  # not floored up, not pushed to critical
    assert health.price_hike_detected


def test_resolution_after_hike_clears_the_flag() -> None:
    sub = item(40)
    events = [
        hike_event(sub, at=datetime(2026, 7, 17, tzinfo=UTC)),
        resolve_event(sub, at=datetime(2026, 7, 18, tzinfo=UTC)),
    ]
    assert not has_unresolved_price_hike(events, current_status=sub.status)
    health = calculate_health(sub, events, today=TODAY)
    assert not health.price_hike_detected
    assert health.mood == "resolved"  # the keep action supersedes the hike


def test_no_renewal_date_with_unresolved_hike_needs_attention() -> None:
    sub = item(1)
    sub.renewal_or_expiry_date = None
    clean = calculate_health(sub, [], today=TODAY)
    assert clean.mood == "healthy" and not clean.needs_attention
    hiked = calculate_health(sub, [hike_event(sub, at=NOON)], today=TODAY)
    assert hiked.mood == "concerned" and hiked.needs_attention


def test_overdue_item_has_no_further_transition() -> None:
    health = calculate_health(item(-2), [], today=TODAY)
    assert health.mood == "critical"
    assert health.next_transition_at is None


def test_next_transition_marks_the_next_boundary() -> None:
    # 26 days out is "happy"; it becomes "healthy" the day it hits 25 remaining.
    health = calculate_health(item(26), [], today=TODAY)
    assert health.mood == "happy"
    renewal = TODAY + timedelta(days=26)
    assert health.next_transition_at == datetime.combine(
        renewal - timedelta(days=25), datetime.min.time(), tzinfo=UTC
    )


def test_next_transition_skips_collapsed_states_under_a_hike() -> None:
    # With a hike, happy/healthy collapse to concerned; the next real change is
    # to "sick" when 3 days remain.
    sub = item(40)
    health = calculate_health(sub, [hike_event(sub, at=NOON)], today=TODAY)
    assert health.mood == "concerned"
    renewal = TODAY + timedelta(days=40)
    assert health.next_transition_at == datetime.combine(
        renewal - timedelta(days=3), datetime.min.time(), tzinfo=UTC
    )
