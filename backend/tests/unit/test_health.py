from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from tamalife_backend.db.models import (
    BillingCycle,
    EventType,
    ItemType,
    Subscription,
    SubscriptionEvent,
)
from tamalife_backend.domain.health import annualized_amount, calculate_health, monthly_amount


def item(days: int) -> Subscription:
    return Subscription(
        id=uuid4(),
        user_id=uuid4(),
        vendor_name="Vendor",
        display_name="Item",
        item_type=ItemType.subscription,
        category="Other",
        amount=Decimal("10"),
        currency="USD",
        billing_cycle=BillingCycle.monthly,
        renewal_or_expiry_date=date(2026, 7, 18).fromordinal(date(2026, 7, 18).toordinal() + days),
        creature_name="Nova",
        creature_species="blob",
    )


def test_health_boundaries() -> None:
    today = date(2026, 7, 18)
    assert calculate_health(item(0), [], today=today).mood == "critical"
    assert calculate_health(item(3), [], today=today).mood == "sick"
    assert calculate_health(item(12), [], today=today).mood == "concerned"
    assert calculate_health(item(25), [], today=today).mood == "healthy"
    assert calculate_health(item(26), [], today=today).mood == "happy"


def test_latest_resolution_clears_attention() -> None:
    subscription = item(1)
    event = SubscriptionEvent(
        subscription_id=subscription.id,
        event_type=EventType.resolved_keep,
        occurred_at=datetime(2026, 7, 18, tzinfo=UTC),
    )
    health = calculate_health(subscription, [event], today=date(2026, 7, 18))
    assert health.mood == "resolved"
    assert health.health_score == 100
    assert not health.needs_attention


def test_cost_normalization() -> None:
    assert annualized_amount(Decimal("10"), BillingCycle.monthly) == Decimal("120.00")
    assert monthly_amount(Decimal("120"), BillingCycle.yearly) == Decimal("10.00")
    assert annualized_amount(Decimal("50"), BillingCycle.one_time) == Decimal("0.00")
