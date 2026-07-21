from __future__ import annotations

import argparse
import asyncio
import json
from uuid import UUID

import uvicorn

from tamalife_backend.config import get_settings
from tamalife_backend.db.models import User
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory


def run() -> None:
    uvicorn.run("tamalife_backend.main:app", host="0.0.0.0", port=8000, reload=False)


async def _seed() -> None:
    settings = get_settings()
    engine = create_engine(settings)
    if settings.auto_create_schema:
        await create_schema(engine)
    factory = create_session_factory(engine)
    async with factory() as session:
        if await session.get(User, settings.default_user_id) is None:
            session.add(User(id=settings.default_user_id, email=settings.default_user_email))
            await session.commit()
    await engine.dispose()


def seed() -> None:
    asyncio.run(_seed())


async def _seed_demo_intelligence() -> None:
    from tamalife_backend.services.demo_intelligence import seed_local_demo_intelligence

    settings = get_settings()
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        seeded = await seed_local_demo_intelligence(session, settings)
        await session.commit()
    await engine.dispose()
    print(f"Seeded simulated local intelligence for {seeded} subscriptions.")


def seed_demo_intelligence() -> None:
    asyncio.run(_seed_demo_intelligence())


def scrape_once() -> None:
    parser = argparse.ArgumentParser(
        description="Run Tamalife price intelligence once without Redis or Celery."
    )
    parser.add_argument("--discover", action="store_true", help="Run bounded OpenAI discovery")
    parser.add_argument(
        "--seed-providers-from-subscriptions",
        action="store_true",
        help="Create inactive-domain provider records from existing subscription vendor names",
    )
    parser.add_argument("--skip-monitor", action="store_true", help="Skip approved source fetches")
    parser.add_argument(
        "--skip-refresh", action="store_true", help="Skip user matching/recommendations"
    )
    parser.add_argument(
        "--force", action="store_true", help="Monitor active sources even if not due"
    )
    parser.add_argument("--provider-id", type=UUID, help="Limit discovery to one provider UUID")
    parser.add_argument("--source-id", type=UUID, help="Limit monitoring to one source UUID")
    parser.add_argument("--user-id", type=UUID, help="Limit refresh to one local user UUID")
    parser.add_argument(
        "--approve-candidate",
        action="append",
        default=[],
        type=UUID,
        help="Explicitly approve a reviewed candidate UUID; repeat for multiple candidates",
    )
    args = parser.parse_args()
    from tamalife_backend.services.manual_scrape import ManualScrapeOptions, run_manual_scrape

    options = ManualScrapeOptions(
        seed_providers_from_subscriptions=args.seed_providers_from_subscriptions,
        discover=args.discover,
        monitor=not args.skip_monitor,
        refresh=not args.skip_refresh,
        force=args.force,
        provider_id=args.provider_id,
        source_id=args.source_id,
        user_id=args.user_id,
        approve_candidate_ids=tuple(args.approve_candidate),
    )
    report = asyncio.run(run_manual_scrape(get_settings(), options))
    print(json.dumps(report.model_dump(), indent=2, sort_keys=True))
