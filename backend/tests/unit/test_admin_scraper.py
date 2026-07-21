from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tamalife_backend.api.dependencies import AuthenticatedUser, admin_user
from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    CandidateStatus,
    Deal,
    PlanPriceHistory,
    PriceChangeType,
    PricingSource,
    Provider,
    ProviderPlan,
    ReviewStatus,
    SourceCandidate,
    SourceDiscoveryRun,
    SourceStatus,
    SourceType,
    User,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.errors import ApiError
from tamalife_backend.main import create_app
from tamalife_backend.services.admin_scraper import (
    approve_candidate,
    reject_candidate,
    review_deal,
    review_price,
    supersede_source,
)


def db_settings(tmp_path: Path) -> Settings:
    return Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'admin.db').as_posix()}",
    )


def test_admin_allowlist_loads_from_prefixed_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TAMALIFE_CLERK_ADMIN_USER_IDS", "user_one,user_two")
    assert Settings(clerk_auth_enabled=False).clerk_admin_user_ids == ["user_one", "user_two"]


@pytest.mark.asyncio
async def test_admin_allowlist_matches_authoritative_clerk_identity() -> None:
    authenticated = AuthenticatedUser(
        user=User(id=uuid4()),
        clerk_user_id="user_actual",
        session_id="session",
        claims={},
    )
    mismatched = Settings(
        clerk_auth_enabled=False,
        clerk_admin_user_ids=["user_someone_else"],
    )
    with pytest.raises(ApiError, match="Administrator access"):
        await admin_user(authenticated, mismatched)

    allowed = Settings(clerk_auth_enabled=False, clerk_admin_user_ids=["user_actual"])
    assert await admin_user(authenticated, allowed) is authenticated


async def add_candidate(
    session: AsyncSession,
    provider: Provider,
    *,
    status: CandidateStatus = CandidateStatus.discovered,
) -> SourceCandidate:
    run = SourceDiscoveryRun(
        provider_id=provider.id,
        run_type="provider",
        country="CA",
        model="test",
        prompt_version="test-v1",
        idempotency_key=str(uuid4()),
        request_id=str(uuid4()),
    )
    session.add(run)
    await session.flush()
    candidate = SourceCandidate(
        discovery_run_id=run.id,
        provider_id=provider.id,
        original_url=f"https://example.com/{uuid4()}",
        normalized_url=f"https://example.com/{uuid4()}",
        normalized_url_hash=uuid4().hex,
        candidate_domain="example.com",
        source_type=SourceType.pricing,
        country="CA",
        currency="CAD",
        first_party=True,
        confidence=0.99,
        status=status,
    )
    session.add(candidate)
    await session.flush()
    return candidate


async def add_verified_source(
    session: AsyncSession, provider: Provider, *, status: SourceStatus = SourceStatus.active
) -> PricingSource:
    candidate = await add_candidate(session, provider, status=CandidateStatus.verified)
    source = PricingSource(
        provider_id=provider.id,
        discovery_candidate_id=candidate.id,
        canonical_url=candidate.normalized_url,
        normalized_url_hash=candidate.normalized_url_hash,
        source_type=SourceType.pricing,
        country="CA",
        currency="CAD",
        status=status,
        next_check_at=datetime.now(UTC),
        last_success_at=datetime.now(UTC),
    )
    session.add(source)
    await session.flush()
    candidate.activated_source_id = source.id
    return source


@pytest.mark.asyncio
async def test_admin_routes_fail_closed_and_allow_only_configured_clerk_id(
    client: httpx.AsyncClient, tmp_path: Path
) -> None:
    denied = await client.get("/v1/admin/scraper/candidates")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "admin_access_denied"

    user_id = uuid4()
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        default_user_id=user_id,
        clerk_admin_user_ids=[f"development:{user_id}"],
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'admin-api.db').as_posix()}",
        auto_create_schema=True,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as admin_client:
            allowed = await admin_client.get("/v1/admin/scraper/candidates")
    assert allowed.status_code == 200
    assert allowed.json() == {"items": [], "next_cursor": None}


@pytest.mark.asyncio
async def test_candidate_approval_is_idempotent_and_rejection_cannot_cross_activation(
    tmp_path: Path,
) -> None:
    settings = db_settings(tmp_path)
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            provider = Provider(name="Provider", slug="provider")
            session.add(provider)
            await session.flush()
            candidate = await add_candidate(session, provider)

            first = await approve_candidate(session, candidate.id)
            second = await approve_candidate(session, candidate.id)

            assert second.id == first.id
            assert candidate.status is CandidateStatus.active
            assert candidate.activated_source_id == first.id
            with pytest.raises(ApiError, match="activated candidate"):
                await reject_candidate(session, candidate.id, "no longer trusted")
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_supersession_requires_verified_active_replacement_and_prevents_cycles(
    tmp_path: Path,
) -> None:
    settings = db_settings(tmp_path)
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            provider = Provider(name="Provider", slug="provider")
            session.add(provider)
            await session.flush()
            source = await add_verified_source(session, provider)
            replacement = await add_verified_source(session, provider)
            replacement.status = SourceStatus.paused
            with pytest.raises(ApiError, match="must be active"):
                await supersede_source(session, source.id, replacement.id)

            replacement.status = SourceStatus.active
            replacement_candidate = await session.get(
                SourceCandidate, replacement.discovery_candidate_id
            )
            assert replacement_candidate is not None
            replacement_candidate.status = CandidateStatus.discovered
            with pytest.raises(ApiError, match="not verified"):
                await supersede_source(session, source.id, replacement.id)
            replacement_candidate.status = CandidateStatus.verified

            replacement.superseded_source_id = source.id
            with pytest.raises(ApiError, match="cycle"):
                await supersede_source(session, source.id, replacement.id)
            replacement.superseded_source_id = None

            result = await supersede_source(session, source.id, replacement.id)
            assert result.status is SourceStatus.superseded
            assert result.superseded_source_id == replacement.id
            assert (await supersede_source(session, source.id, replacement.id)).id == source.id
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_price_and_deal_reviews_are_final_and_rejection_deactivates_deal(
    tmp_path: Path,
) -> None:
    settings = db_settings(tmp_path)
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            provider = Provider(name="Provider", slug="provider")
            session.add(provider)
            await session.flush()
            source = await add_verified_source(session, provider)
            plan = ProviderPlan(
                provider_id=provider.id,
                source_id=source.id,
                external_key="premium",
                name="Premium",
                normalized_name="premium",
                country="CA",
                currency="CAD",
                billing_cycle=BillingCycle.monthly,
                current_price=Decimal("12.00"),
            )
            session.add(plan)
            await session.flush()
            history = PlanPriceHistory(
                plan_id=plan.id,
                price=Decimal("12.00"),
                previous_price=Decimal("10.00"),
                change_type=PriceChangeType.increase,
                confidence=0.9,
                evidence_hash=uuid4().hex,
            )
            deal = Deal(
                provider_id=provider.id,
                source_id=source.id,
                fingerprint=uuid4().hex,
                title="Student deal",
                country="CA",
                source_url=source.canonical_url,
                confidence=0.8,
            )
            session.add_all([history, deal])
            await session.flush()

            assert (
                await review_price(session, history.id, ReviewStatus.approved)
            ).review_status is ReviewStatus.approved
            with pytest.raises(ApiError, match="already finalized"):
                await review_price(session, history.id, ReviewStatus.rejected)
            rejected = await review_deal(session, deal.id, ReviewStatus.rejected)
            assert rejected.review_status is ReviewStatus.rejected
            assert rejected.active is False
    finally:
        await engine.dispose()
