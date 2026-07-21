from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    Deal,
    ItemType,
    PlanAlternative,
    PlanPriceHistory,
    Subscription,
    User,
    UserPlanMatch,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.demo_intelligence import seed_local_demo_intelligence


async def test_local_demo_seed_adds_walkthrough_data_and_keeps_spotify_without_an_offer(
    tmp_path: Path,
) -> None:
    settings = Settings(
        environment="local",
        clerk_auth_enabled=False,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'demo.db').as_posix()}",
    )
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    async with factory() as session:
        user = User(email="demo@example.com")
        session.add(user)
        await session.flush()
        spotify = Subscription(
            user_id=user.id,
            vendor_name="Spotify",
            display_name="Spotify Premium",
            item_type=ItemType.subscription,
            amount=Decimal("11.99"),
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
        )
        netflix = Subscription(
            user_id=user.id,
            vendor_name="Netflix",
            display_name="Netflix Premium",
            item_type=ItemType.subscription,
            amount=Decimal("22.99"),
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
        )
        session.add_all([spotify, netflix])
        await session.flush()

        assert await seed_local_demo_intelligence(session, settings) == 2
        assert await session.scalar(select(func.count()).select_from(UserPlanMatch)) == 2
        assert await session.scalar(select(func.count()).select_from(PlanPriceHistory)) == 2
        assert await session.scalar(select(func.count()).select_from(Deal)) == 1
        assert await session.scalar(select(func.count()).select_from(PlanAlternative)) == 1
    await engine.dispose()
