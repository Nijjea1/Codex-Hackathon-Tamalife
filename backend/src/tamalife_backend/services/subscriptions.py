from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from tamalife_backend.db.models import Subscription, User
from tamalife_backend.domain.health import annualized_amount, calculate_health, monthly_amount
from tamalife_backend.schemas import SubscriptionResponse


async def load_subscription(
    session: AsyncSession, user: User, subscription_id: object
) -> Subscription | None:
    result = await session.execute(
        select(Subscription)
        .options(selectinload(Subscription.events))
        .where(
            Subscription.id == subscription_id,
            Subscription.user_id == user.id,
            Subscription.archived_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


def to_response(subscription: Subscription, *, today: date | None = None) -> SubscriptionResponse:
    health = calculate_health(subscription, list(subscription.events), today=today)
    if health.mood == "resolved":
        attention_state = "resolved"
    elif health.days_remaining is not None and health.days_remaining <= 0:
        attention_state = "overdue"
    elif health.days_remaining is not None and health.days_remaining <= 3:
        attention_state = "urgent"
    elif health.needs_attention:
        attention_state = "upcoming"
    else:
        attention_state = "none"
    return SubscriptionResponse(
        id=subscription.id,
        vendor_name=subscription.vendor_name,
        display_name=subscription.display_name,
        item_type=subscription.item_type,
        category=subscription.category,
        amount=subscription.amount,
        previous_amount=subscription.previous_amount,
        currency=subscription.currency,
        billing_cycle=subscription.billing_cycle,
        renewal_or_expiry_date=subscription.renewal_or_expiry_date,
        cancellation_difficulty=subscription.cancellation_difficulty,
        status=subscription.status,
        creature_name=subscription.creature_name,
        creature_species=subscription.creature_species,
        notes=subscription.notes,
        created_at=subscription.created_at,
        updated_at=subscription.updated_at,
        days_remaining=health.days_remaining,
        health_score=health.health_score,
        mood=health.mood,
        needs_attention=health.needs_attention,
        attention_state=attention_state,
        health_reason=health.reason,
        price_hike_detected=health.price_hike_detected,
        next_transition_at=health.next_transition_at,
        monthly_cost=monthly_amount(subscription.amount, subscription.billing_cycle),
        annual_cost=annualized_amount(subscription.amount, subscription.billing_cycle),
    )


def totals(subscriptions: list[Subscription]) -> tuple[Decimal, Decimal]:
    monthly = sum(
        (monthly_amount(item.amount, item.billing_cycle) for item in subscriptions),
        start=Decimal("0"),
    )
    annual = sum(
        (annualized_amount(item.amount, item.billing_cycle) for item in subscriptions),
        start=Decimal("0"),
    )
    return monthly.quantize(Decimal("0.01")), annual.quantize(Decimal("0.01"))
