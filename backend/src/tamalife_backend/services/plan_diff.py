from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    Deal,
    PlanPriceHistory,
    PriceChangeType,
    ProviderPlan,
    ReviewStatus,
    SourceFetch,
)
from tamalife_backend.services.pricing_extraction import ExtractedPricingCatalog


@dataclass(frozen=True)
class PublicationOutcome:
    fetch_id: UUID
    created_plans: int
    changed_prices: int
    published_deals: int
    reused: bool


def _monthly(price: Decimal, cycle: BillingCycle) -> Decimal | None:
    if cycle is BillingCycle.weekly:
        return (price * Decimal(52) / Decimal(12)).quantize(Decimal("0.01"))
    if cycle is BillingCycle.monthly:
        return price
    if cycle is BillingCycle.yearly:
        return (price / Decimal(12)).quantize(Decimal("0.01"))
    return None


async def publish_source_fetch(
    session: AsyncSession, settings: Settings, fetch_id: UUID
) -> PublicationOutcome:
    fetch = await session.get(SourceFetch, fetch_id)
    if fetch is None or fetch.extracted_data is None:
        raise ValueError("extracted source fetch not found")
    if fetch.publication_completed_at is not None:
        return PublicationOutcome(fetch.id, 0, 0, 0, True)
    source = fetch.source_id
    from tamalife_backend.db.models import PricingSource

    pricing_source = await session.get(PricingSource, source)
    if pricing_source is None:
        raise ValueError("pricing source not found")
    catalog = ExtractedPricingCatalog.model_validate(fetch.extracted_data)
    existing = list(
        (
            await session.scalars(
                select(ProviderPlan).where(ProviderPlan.source_id == pricing_source.id)
            )
        ).all()
    )
    by_key = {(plan.external_key, plan.currency, plan.billing_cycle): plan for plan in existing}
    observed_ids: set[UUID] = set()
    created = 0
    changed = 0
    now = fetch.completed_at or datetime.now(UTC)
    for extracted in catalog.plans:
        key = (extracted.external_key, extracted.currency, extracted.billing_cycle)
        plan = by_key.get(key)
        previous: Decimal | None = None
        change_type = PriceChangeType.initial
        if plan is None:
            plan = ProviderPlan(
                provider_id=pricing_source.provider_id,
                source_id=pricing_source.id,
                external_key=extracted.external_key,
                name=extracted.name,
                normalized_name=" ".join(extracted.name.lower().split()),
                country=pricing_source.country,
                currency=extracted.currency,
                billing_cycle=extracted.billing_cycle,
                current_price=extracted.price,
                monthly_equivalent=_monthly(extracted.price, extracted.billing_cycle),
                confidence=extracted.confidence,
                first_observed_at=now,
                last_observed_at=now,
            )
            session.add(plan)
            await session.flush()
            created += 1
        else:
            previous = plan.current_price
            if extracted.price > previous:
                change_type = PriceChangeType.increase
            elif extracted.price < previous:
                change_type = PriceChangeType.decrease
            else:
                change_type = PriceChangeType.unchanged
            plan.name = extracted.name
            plan.normalized_name = " ".join(extracted.name.lower().split())
            plan.current_price = extracted.price
            plan.monthly_equivalent = _monthly(extracted.price, extracted.billing_cycle)
            plan.confidence = extracted.confidence
            plan.last_observed_at = now
            plan.active = True
            plan.missing_observation_count = 0
        observed_ids.add(plan.id)
        if change_type is PriceChangeType.unchanged:
            continue
        evidence_hash = hashlib.sha256(
            f"{fetch.content_hash}:{extracted.external_key}:{extracted.price}".encode()
        ).hexdigest()
        known_history = await session.scalar(
            select(PlanPriceHistory.id).where(
                PlanPriceHistory.plan_id == plan.id,
                PlanPriceHistory.evidence_hash == evidence_hash,
            )
        )
        if known_history is not None:
            continue
        amount = extracted.price - previous if previous is not None else None
        percentage = (
            (amount / previous * Decimal(100)).quantize(Decimal("0.001"))
            if amount is not None and previous
            else None
        )
        session.add(
            PlanPriceHistory(
                plan_id=plan.id,
                source_fetch_id=fetch.id,
                price=extracted.price,
                previous_price=previous,
                change_amount=amount,
                change_percentage=percentage,
                change_type=change_type,
                observed_at=now,
                confidence=extracted.confidence,
                review_status=(
                    ReviewStatus.auto_approved
                    if extracted.confidence >= settings.discovery_min_auto_activate_confidence
                    else ReviewStatus.pending
                ),
                evidence_hash=evidence_hash,
            )
        )
        if previous is not None:
            changed += 1

    for plan in existing:
        if plan.id in observed_ids:
            continue
        plan.missing_observation_count += 1
        if plan.missing_observation_count >= settings.scraper_missing_plan_threshold:
            plan.active = False

    deals_published = 0
    for deal_item in catalog.deals:
        fingerprint = hashlib.sha256(
            f"{pricing_source.id}:{deal_item.title.lower()}:{deal_item.promotional_price}".encode()
        ).hexdigest()
        deal = await session.scalar(
            select(Deal).where(
                Deal.provider_id == pricing_source.provider_id,
                Deal.source_id == pricing_source.id,
                Deal.fingerprint == fingerprint,
            )
        )
        if deal is not None:
            deal.active = True
            deal.confidence = max(deal.confidence, deal_item.confidence)
            continue
        session.add(
            Deal(
                provider_id=pricing_source.provider_id,
                source_id=pricing_source.id,
                fingerprint=fingerprint,
                title=deal_item.title,
                promotional_price=deal_item.promotional_price,
                currency=deal_item.currency,
                country=pricing_source.country,
                source_url=pricing_source.canonical_url,
                confidence=deal_item.confidence,
                review_status=(
                    ReviewStatus.auto_approved
                    if deal_item.confidence >= settings.discovery_min_auto_activate_confidence
                    else ReviewStatus.pending
                ),
            )
        )
        deals_published += 1
    fetch.publication_completed_at = now
    await session.flush()
    return PublicationOutcome(fetch.id, created, changed, deals_published, False)
