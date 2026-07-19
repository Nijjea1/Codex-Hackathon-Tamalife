from __future__ import annotations

from unittest.mock import patch

from tamalife_backend.config import Settings
from tamalife_backend.db.session import create_engine


def test_postgres_engine_disables_asyncpg_statement_cache() -> None:
    settings = Settings(
        environment="test",
        database_url="postgresql+asyncpg://user:password@db.example.com/postgres",
    )

    with patch("tamalife_backend.db.session.create_async_engine") as engine_factory:
        create_engine(settings)

    connect_args = engine_factory.call_args.kwargs["connect_args"]
    assert connect_args["statement_cache_size"] == 0
