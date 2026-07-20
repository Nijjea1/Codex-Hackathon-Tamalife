from __future__ import annotations

import asyncio

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
