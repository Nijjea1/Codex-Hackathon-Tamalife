from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    PricingSource,
    SourceFetch,
    SourceFetchStatus,
    SourceStatus,
)
from tamalife_backend.services.plan_diff import publish_source_fetch
from tamalife_backend.services.pricing_extraction import extract_pricing_catalog
from tamalife_backend.services.safe_fetch import FetchRejectedError, fetch_url


@dataclass(frozen=True)
class MonitoringOutcome:
    source_id: UUID
    fetch_id: UUID | None
    status: SourceFetchStatus
    changed: bool


async def monitor_pricing_source(
    session: AsyncSession,
    settings: Settings,
    source_id: UUID,
    *,
    lease_token: str,
    request_id: str,
) -> MonitoringOutcome:
    source = await session.get(PricingSource, source_id)
    if source is None or source.lease_token != lease_token:
        raise ValueError("source lease is missing or no longer owned")
    now = datetime.now(UTC)
    try:
        result = await fetch_url(
            source.canonical_url,
            settings,
            etag=source.etag,
            last_modified=source.last_modified,
        )
        if result.not_modified or result.content_hash == source.content_hash:
            fetch = SourceFetch(
                source_id=source.id,
                request_id=request_id,
                status=SourceFetchStatus.not_modified,
                completed_at=now,
                http_status=result.status,
                duration_ms=result.duration_ms,
                content_type=result.content_type,
                byte_count=len(result.body),
                changed=False,
            )
            session.add(fetch)
            source.last_checked_at = now
            source.last_success_at = now
            source.next_check_at = now + timedelta(seconds=source.check_interval_seconds)
            source.etag = result.etag or source.etag
            source.last_modified = result.last_modified or source.last_modified
            source.consecutive_failures = 0
            source.status = SourceStatus.active
            source.lease_token = None
            source.lease_expires_at = None
            await session.flush()
            previous_fetch = await session.scalar(
                select(SourceFetch)
                .where(
                    SourceFetch.source_id == source.id,
                    SourceFetch.status == SourceFetchStatus.extracted,
                    SourceFetch.publication_completed_at.is_not(None),
                )
                .order_by(SourceFetch.completed_at.desc(), SourceFetch.id.desc())
                .limit(1)
            )
            if previous_fetch is not None:
                await publish_source_fetch(session, settings, previous_fetch.id)
            return MonitoringOutcome(source.id, fetch.id, fetch.status, False)

        catalog = extract_pricing_catalog(
            result.body, default_currency=source.currency or settings.discovery_currency
        )
        fetch = SourceFetch(
            source_id=source.id,
            request_id=request_id,
            status=SourceFetchStatus.extracted,
            completed_at=now,
            http_status=result.status,
            duration_ms=result.duration_ms,
            content_type=result.content_type,
            byte_count=len(result.body),
            content_hash=result.content_hash,
            semantic_hash=catalog.semantic_hash,
            changed=catalog.semantic_hash != source.semantic_hash,
            extraction_strategy=catalog.strategy,
            extraction_version=catalog.version,
            extracted_data=catalog.model_dump(mode="json"),
            confidence=min((plan.confidence for plan in catalog.plans), default=0.0),
        )
        session.add(fetch)
        await session.flush()
        await publish_source_fetch(session, settings, fetch.id)
        source.last_checked_at = now
        source.last_success_at = now
        source.next_check_at = now + timedelta(seconds=source.check_interval_seconds)
        source.etag = result.etag
        source.last_modified = result.last_modified
        source.content_hash = result.content_hash
        source.semantic_hash = catalog.semantic_hash
        source.consecutive_failures = 0
        source.status = SourceStatus.active
        source.lease_token = None
        source.lease_expires_at = None
        await session.flush()
        return MonitoringOutcome(source.id, fetch.id, fetch.status, fetch.changed)
    except FetchRejectedError:
        source.last_checked_at = now
        source.consecutive_failures += 1
        source.status = SourceStatus.failing
        source.next_check_at = now + timedelta(
            seconds=min(source.check_interval_seconds * 2**source.consecutive_failures, 604800)
        )
        source.lease_token = None
        source.lease_expires_at = None
        raise
