from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    ItemType,
    PricingSource,
    Provider,
    ProviderPlan,
    SourceType,
    Subscription,
    SubscriptionStatus,
    User,
    UserPlanMatch,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.tasks import recommendation_refresh
from tamalife_backend.tasks.celery_app import build_beat_schedule, celery_app


def refresh_settings(tmp_path: Path | None = None, *, enabled: bool = True) -> Settings:
    database_url = (
        f"sqlite+aiosqlite:///{(tmp_path / 'recommendation-refresh.db').as_posix()}"
        if tmp_path
        else "sqlite+aiosqlite:///:memory:"
    )
    return Settings(
        environment="test",
        clerk_auth_enabled=False,
        database_url=database_url,
        price_intelligence_refresh_enabled=enabled,
        price_intelligence_refresh_interval_seconds=900,
        price_intelligence_refresh_batch_size=2,
    )


async def add_user_subscription(
    config: Settings,
    *,
    status: SubscriptionStatus = SubscriptionStatus.active,
    archived: bool = False,
    disabled: bool = False,
) -> UUID:
    from datetime import UTC, datetime

    engine = create_engine(config)
    await create_schema(engine)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            user = User(disabled_at=datetime.now(UTC) if disabled else None)
            session.add(user)
            await session.flush()
            session.add(
                Subscription(
                    user_id=user.id,
                    vendor_name="Provider",
                    display_name="Plan",
                    item_type=ItemType.subscription,
                    category="Other",
                    amount=Decimal("10.00"),
                    currency="CAD",
                    billing_cycle=BillingCycle.monthly,
                    status=status,
                    creature_name="Nova",
                    creature_species="blob",
                    archived_at=datetime.now(UTC) if archived else None,
                )
            )
            await session.commit()
            return user.id
    finally:
        await engine.dispose()


def test_refresh_beat_and_tasks_are_configuration_gated() -> None:
    disabled = build_beat_schedule(refresh_settings(enabled=False))
    enabled_settings = refresh_settings(enabled=True)
    enabled = build_beat_schedule(enabled_settings)

    assert "refresh-price-intelligence" not in disabled
    assert enabled["refresh-price-intelligence"] == {
        "task": "tamalife.schedule_price_intelligence_refresh",
        "schedule": float(enabled_settings.price_intelligence_refresh_interval_seconds),
    }

    celery_app.loader.import_default_modules()
    assert "tamalife.schedule_price_intelligence_refresh" in celery_app.tasks
    assert "tamalife.refresh_user_price_intelligence" in celery_app.tasks


def test_disabled_manual_tasks_do_not_access_database(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = refresh_settings(enabled=False)
    monkeypatch.setattr(recommendation_refresh, "settings", config)

    async def unexpected(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("disabled refresh must not access the database")

    monkeypatch.setattr(recommendation_refresh, "_dispatch_refreshes", unexpected)
    monkeypatch.setattr(recommendation_refresh, "_refresh_user", unexpected)

    assert recommendation_refresh.schedule_price_intelligence_refresh.run() == 0
    assert recommendation_refresh.refresh_user_price_intelligence_task.run(str(uuid4())) == {
        "status": "disabled"
    }


@pytest.mark.asyncio
async def test_user_batch_is_bounded_to_active_unarchived_enabled_users(tmp_path: Path) -> None:
    config = refresh_settings(tmp_path)
    first = await add_user_subscription(config)
    second = await add_user_subscription(config)
    third = await add_user_subscription(config)
    canceled = await add_user_subscription(config, status=SubscriptionStatus.canceled)
    archived = await add_user_subscription(config, archived=True)
    disabled = await add_user_subscription(config, disabled=True)

    user_ids = await recommendation_refresh._eligible_user_ids(config)

    assert user_ids == sorted([first, second, third])[:2]
    assert not {canceled, archived, disabled}.intersection(user_ids)


@pytest.mark.asyncio
async def test_dispatch_propagates_request_id(monkeypatch: pytest.MonkeyPatch) -> None:
    config = refresh_settings(enabled=True)
    user_ids = [uuid4(), uuid4()]
    calls: list[tuple[list[str], dict[str, str]]] = []

    async def eligible(_config: Settings) -> list[UUID]:
        return user_ids

    def dispatch(*, args: list[str], headers: dict[str, str]) -> None:
        calls.append((args, headers))

    monkeypatch.setattr(recommendation_refresh, "_eligible_user_ids", eligible)
    monkeypatch.setattr(
        recommendation_refresh.refresh_user_price_intelligence_task,
        "apply_async",
        dispatch,
    )

    assert await recommendation_refresh._dispatch_refreshes(config, "request-123") == 2
    assert calls == [
        ([str(user_ids[0])], {"request_id": "request-123"}),
        ([str(user_ids[1])], {"request_id": "request-123"}),
    ]


@pytest.mark.asyncio
async def test_repeated_refresh_is_idempotent(tmp_path: Path) -> None:
    config = refresh_settings(tmp_path)
    engine = create_engine(config)
    await create_schema(engine)
    factory = create_session_factory(engine)
    user_id = uuid4()
    try:
        async with factory() as session:
            session.add(User(id=user_id))
            provider = Provider(name="Stream Flix", slug="stream-flix")
            session.add(provider)
            await session.flush()
            source = PricingSource(
                provider_id=provider.id,
                canonical_url="https://example.com/pricing",
                normalized_url_hash="a" * 64,
                source_type=SourceType.pricing,
                country="CA",
                currency="CAD",
            )
            session.add(source)
            await session.flush()
            session.add(
                ProviderPlan(
                    provider_id=provider.id,
                    source_id=source.id,
                    external_key="premium",
                    name="Premium",
                    normalized_name="premium",
                    country="CA",
                    currency="CAD",
                    billing_cycle=BillingCycle.monthly,
                    current_price=Decimal("20.00"),
                    monthly_equivalent=Decimal("20.00"),
                )
            )
            session.add(
                Subscription(
                    user_id=user_id,
                    vendor_name="Stream Flix",
                    display_name="Premium",
                    item_type=ItemType.subscription,
                    category="Entertainment",
                    amount=Decimal("20.00"),
                    currency="CAD",
                    billing_cycle=BillingCycle.monthly,
                    creature_name="Nova",
                    creature_species="blob",
                )
            )
            await session.commit()
    finally:
        await engine.dispose()

    first = await recommendation_refresh._refresh_user(
        user_id, config=config, request_id="request-first"
    )
    second = await recommendation_refresh._refresh_user(
        user_id, config=config, request_id="request-second"
    )

    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            match_count = await session.scalar(select(func.count(UserPlanMatch.id)))
    finally:
        await engine.dispose()
    assert first["matches_created"] == 1
    assert second["matches_created"] == 0
    assert match_count == 1


@pytest.mark.asyncio
async def test_refresh_rolls_back_matching_when_recommendation_generation_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = refresh_settings(tmp_path)
    user_id = await add_user_subscription(config)

    @dataclass(frozen=True)
    class MatchOutcome:
        created: int = 1
        updated: int = 0
        unmatched: int = 0

    async def mutate_user(session: object, value: UUID) -> MatchOutcome:
        user = await session.get(User, value)  # type: ignore[attr-defined]
        user.display_name = "must roll back"
        return MatchOutcome()

    async def fail_generation(
        _session: object,
        _user_id: UUID,
        *,
        request_id: str,
    ) -> object:
        assert request_id == "request-failure"
        raise RuntimeError("generation failed")

    monkeypatch.setattr(
        "tamalife_backend.services.recommendations.match_user_subscriptions",
        mutate_user,
    )
    monkeypatch.setattr(
        "tamalife_backend.services.recommendations.generate_user_recommendations",
        fail_generation,
    )

    with pytest.raises(RuntimeError, match="generation failed"):
        await recommendation_refresh._refresh_user(
            user_id,
            config=config,
            request_id="request-failure",
        )

    engine = create_engine(config)
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            user = await session.get(User, user_id)
            assert user is not None
            assert user.display_name is None
    finally:
        await engine.dispose()
