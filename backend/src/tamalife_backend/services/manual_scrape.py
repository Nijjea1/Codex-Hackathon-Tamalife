from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select, update

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    PricingSource,
    Provider,
    SourceStatus,
    Subscription,
    SubscriptionStatus,
    User,
)
from tamalife_backend.db.session import create_engine, create_session_factory
from tamalife_backend.services.admin_scraper import approve_candidate
from tamalife_backend.services.recommendations import (
    generate_user_recommendations,
    match_user_subscriptions,
)
from tamalife_backend.services.scraper_discovery import discover_provider_sources
from tamalife_backend.services.source_monitoring import monitor_pricing_source


@dataclass(frozen=True)
class ManualScrapeOptions:
    seed_providers_from_subscriptions: bool = False
    discover: bool = False
    monitor: bool = True
    refresh: bool = True
    force: bool = False
    provider_id: UUID | None = None
    source_id: UUID | None = None
    user_id: UUID | None = None
    approve_candidate_ids: tuple[UUID, ...] = ()


@dataclass
class ManualScrapeReport:
    providers_seeded: int = 0
    providers_discovered: int = 0
    candidates_found: int = 0
    candidates_approved: int = 0
    sources_monitored: int = 0
    sources_changed: int = 0
    users_refreshed: int = 0
    matches_created: int = 0
    recommendations_created: int = 0
    alerts_created: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)


def _error(report: ManualScrapeReport, stage: str, item_id: UUID, exc: Exception) -> None:
    report.errors.append(
        {"stage": stage, "item_id": str(item_id), "error_type": type(exc).__name__}
    )


def _provider_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")
    return slug[:200] or f"provider-{uuid4().hex[:12]}"


async def run_manual_scrape(
    settings: Settings,
    options: ManualScrapeOptions,
    *,
    request_id: str | None = None,
) -> ManualScrapeReport:
    report = ManualScrapeReport()
    current_request_id = request_id or str(uuid4())
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    try:
        if options.seed_providers_from_subscriptions:
            async with factory() as session:
                rows = (
                    await session.execute(
                        select(Subscription.vendor_name, Subscription.category)
                        .where(Subscription.archived_at.is_(None))
                        .distinct()
                        .order_by(Subscription.vendor_name)
                        .limit(settings.discovery_max_providers_per_run)
                    )
                ).all()
                seen_slugs: set[str] = set()
                for vendor_name, category in rows:
                    slug = _provider_slug(vendor_name)
                    # The query is distinct by vendor/category. A provider slug is
                    # distinct only by vendor, so the same merchant can appear more
                    # than once when subscriptions use different categories.
                    if slug in seen_slugs:
                        continue
                    seen_slugs.add(slug)
                    existing = await session.scalar(
                        select(Provider.id).where(Provider.slug == slug)
                    )
                    if existing is None:
                        session.add(
                            Provider(
                                name=vendor_name,
                                slug=slug,
                                category=category or "Other",
                                policy_status="demo_pending",
                            )
                        )
                        report.providers_seeded += 1
                await session.commit()
        if options.discover:
            discovery_settings = settings.model_copy(update={"discovery_enabled": True})
            if not discovery_settings.openai_api_key:
                raise ValueError("TAMALIFE_OPENAI_API_KEY is required with --discover")
            async with factory() as session:
                query = (
                    select(Provider.id)
                    .where(Provider.active.is_(True))
                    .order_by(Provider.id)
                    .limit(settings.discovery_max_providers_per_run)
                )
                if options.provider_id is not None:
                    query = query.where(Provider.id == options.provider_id)
                provider_ids = list((await session.scalars(query)).all())
            for provider_id in provider_ids:
                async with factory() as session:
                    try:
                        discovery_outcome = await discover_provider_sources(
                            session,
                            discovery_settings,
                            provider_id,
                            request_id=current_request_id,
                        )
                        await session.commit()
                        report.providers_discovered += 1
                        report.candidates_found += discovery_outcome.candidate_count
                    except Exception as exc:
                        await session.rollback()
                        _error(report, "discovery", provider_id, exc)

        for candidate_id in options.approve_candidate_ids:
            async with factory() as session:
                try:
                    await approve_candidate(session, candidate_id)
                    await session.commit()
                    report.candidates_approved += 1
                except Exception as exc:
                    await session.rollback()
                    _error(report, "candidate_approval", candidate_id, exc)

        if options.monitor:
            now = datetime.now(UTC)
            async with factory() as session:
                query = (
                    select(PricingSource.id)
                    .where(PricingSource.status.in_((SourceStatus.active, SourceStatus.failing)))
                    .order_by(PricingSource.next_check_at, PricingSource.id)
                    .limit(settings.scraper_source_batch_size)
                )
                if not options.force:
                    query = query.where(PricingSource.next_check_at <= now)
                if options.source_id is not None:
                    query = query.where(PricingSource.id == options.source_id)
                source_ids = list((await session.scalars(query)).all())
            for source_id in source_ids:
                lease_token = str(uuid4())
                async with factory() as session:
                    try:
                        source = await session.get(PricingSource, source_id)
                        if source is None:
                            continue
                        lease_expires_at = source.lease_expires_at
                        if lease_expires_at is not None and lease_expires_at.tzinfo is None:
                            lease_expires_at = lease_expires_at.replace(tzinfo=UTC)
                        if (
                            source.lease_token is not None
                            and lease_expires_at is not None
                            and lease_expires_at > now
                        ):
                            continue
                        source.lease_token = lease_token
                        source.lease_expires_at = now + timedelta(
                            seconds=settings.scraper_source_lease_seconds
                        )
                        await session.commit()
                        monitoring_outcome = await monitor_pricing_source(
                            session,
                            settings,
                            source_id,
                            lease_token=lease_token,
                            request_id=current_request_id,
                        )
                        await session.commit()
                        report.sources_monitored += 1
                        report.sources_changed += int(monitoring_outcome.changed)
                    except Exception as exc:
                        await session.rollback()
                        await session.execute(
                            update(PricingSource)
                            .where(
                                PricingSource.id == source_id,
                                PricingSource.lease_token == lease_token,
                            )
                            .values(
                                lease_token=None,
                                lease_expires_at=None,
                                status=SourceStatus.failing,
                                last_checked_at=datetime.now(UTC),
                                next_check_at=datetime.now(UTC)
                                + timedelta(seconds=settings.scraper_monitor_interval_seconds),
                                consecutive_failures=PricingSource.consecutive_failures + 1,
                            )
                        )
                        await session.commit()
                        _error(report, "monitoring", source_id, exc)

        if options.refresh:
            async with factory() as session:
                query = (
                    select(Subscription.user_id)
                    .join(User, User.id == Subscription.user_id)
                    .where(
                        Subscription.status == SubscriptionStatus.active,
                        Subscription.archived_at.is_(None),
                        User.disabled_at.is_(None),
                        User.deleted_at.is_(None),
                    )
                    .distinct()
                    .order_by(Subscription.user_id)
                    .limit(settings.price_intelligence_refresh_batch_size)
                )
                if options.user_id is not None:
                    query = query.where(Subscription.user_id == options.user_id)
                user_ids = list((await session.scalars(query)).all())
            for user_id in user_ids:
                async with factory() as session:
                    try:
                        matches = await match_user_subscriptions(session, user_id)
                        recommendations = await generate_user_recommendations(
                            session,
                            user_id,
                            request_id=current_request_id,
                        )
                        await session.commit()
                        report.users_refreshed += 1
                        report.matches_created += matches.created
                        report.recommendations_created += recommendations.recommendations_created
                        report.alerts_created += recommendations.alerts_created
                    except Exception as exc:
                        await session.rollback()
                        _error(report, "recommendation_refresh", user_id, exc)
        return report
    finally:
        await engine.dispose()
