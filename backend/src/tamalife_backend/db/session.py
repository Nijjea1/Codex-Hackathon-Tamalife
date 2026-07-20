from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from tamalife_backend.config import Settings

from .base import Base


def create_engine(settings: Settings) -> AsyncEngine:
    kwargs: dict[str, object] = {"echo": settings.database_echo, "pool_pre_ping": True}
    if not settings.database_url.startswith("sqlite"):
        kwargs["pool_size"] = settings.database_pool_size
        kwargs["connect_args"] = {
            "statement_cache_size": 0,
            "server_settings": {
                "statement_timeout": str(settings.database_statement_timeout_ms),
            },
        }
    return create_async_engine(settings.database_url, **kwargs)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def create_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def session_scope(
    factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncSession]:
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
