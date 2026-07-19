from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, status
from sqlalchemy import select

from tamalife_backend.api.dependencies import AuthenticatedUserDep, SessionDep, StorageDep
from tamalife_backend.db.models import (
    IdempotencyKey,
    NotificationPreference,
    ParsedReceipt,
    Subscription,
    WidgetToken,
)
from tamalife_backend.schemas import MeResponse

router = APIRouter(prefix="/me", tags=["identity"])


@router.get("", response_model=MeResponse)
async def read_me(authenticated: AuthenticatedUserDep) -> MeResponse:
    return MeResponse(
        user_id=authenticated.user.id,
        clerk_user_id=authenticated.clerk_user_id,
        session_id=authenticated.session_id,
        claims=authenticated.claims,
    )


@router.get("/export", response_model=dict)
async def export_my_data(
    authenticated: AuthenticatedUserDep, session: SessionDep
) -> dict[str, Any]:
    user = authenticated.user
    subscriptions = list(
        (
            await session.execute(select(Subscription).where(Subscription.user_id == user.id))
        ).scalars()
    )
    receipts = list(
        (
            await session.execute(select(ParsedReceipt).where(ParsedReceipt.user_id == user.id))
        ).scalars()
    )
    preference = await session.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "user": {
            "id": str(user.id),
            "clerk_user_id": user.clerk_user_id,
            "email": user.email,
            "display_name": user.display_name,
            "created_at": user.created_at.isoformat(),
        },
        "subscriptions": [
            {
                "id": str(item.id),
                "vendor_name": item.vendor_name,
                "display_name": item.display_name,
                "item_type": item.item_type.value,
                "category": item.category,
                "amount": str(item.amount),
                "currency": item.currency,
                "billing_cycle": item.billing_cycle.value,
                "renewal_or_expiry_date": (
                    item.renewal_or_expiry_date.isoformat() if item.renewal_or_expiry_date else None
                ),
                "status": item.status.value,
                "notes": item.notes,
            }
            for item in subscriptions
        ],
        "parsed_receipts": [
            {
                "id": str(item.id),
                "input_type": item.raw_input_type.value,
                "status": item.status.value,
                "raw_text": item.raw_text,
                "extracted": item.extracted_payload,
                "created_at": item.created_at.isoformat(),
            }
            for item in receipts
        ],
        "notification_preferences": (
            {
                "reminder_days_before": preference.reminder_days_before,
                "push_enabled": preference.push_enabled,
                "email_enabled": preference.email_enabled,
            }
            if preference
            else None
        ),
    }


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_data(
    authenticated: AuthenticatedUserDep, session: SessionDep, storage: StorageDep
) -> None:
    user = authenticated.user
    receipts = list(
        (
            await session.execute(select(ParsedReceipt).where(ParsedReceipt.user_id == user.id))
        ).scalars()
    )
    for receipt in receipts:
        if receipt.storage_path:
            await storage.delete(receipt.storage_path)
        await session.delete(receipt)

    for model in (Subscription, NotificationPreference, IdempotencyKey):
        records = list(
            (await session.execute(select(model).where(model.user_id == user.id))).scalars()
        )
        for record in records:
            await session.delete(record)

    tokens = list(
        (await session.execute(select(WidgetToken).where(WidgetToken.user_id == user.id))).scalars()
    )
    now = datetime.now(UTC)
    for token in tokens:
        token.revoked_at = now
    user.email = None
    user.display_name = None
    user.image_url = None
    user.disabled_at = now
    user.deleted_at = now
