from datetime import date

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from tamalife_backend.api.dependencies import SessionDep, UserDep
from tamalife_backend.db.models import Subscription, SubscriptionStatus
from tamalife_backend.schemas import DashboardSummary
from tamalife_backend.services.subscriptions import to_response, totals

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(session: SessionDep, user: UserDep) -> DashboardSummary:
    result = await session.execute(
        select(Subscription)
        .options(selectinload(Subscription.events))
        .where(
            Subscription.user_id == user.id,
            Subscription.archived_at.is_(None),
            Subscription.status == SubscriptionStatus.active,
        )
    )
    subscriptions = list(result.scalars().all())
    items = [to_response(item) for item in subscriptions]
    dated = [item for item in items if item.renewal_or_expiry_date is not None]
    monthly, annual = totals(subscriptions)
    return DashboardSummary(
        active_count=len(items),
        needs_attention_count=sum(item.needs_attention for item in items),
        overdue_count=sum(item.attention_state == "overdue" for item in items),
        monthly_cost=monthly,
        annual_cost=annual,
        next_item=(
            min(dated, key=lambda item: item.renewal_or_expiry_date or date.max) if dated else None
        ),
    )
