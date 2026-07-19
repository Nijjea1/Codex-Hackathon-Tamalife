import pytest
from pydantic import ValidationError

from tamalife_backend.config import Settings


def test_comma_separated_cors_origins(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv(
        "TAMALIFE_CORS_ORIGINS",
        "http://localhost:8081,http://localhost:19006",
    )
    assert Settings().cors_origins == ["http://localhost:8081", "http://localhost:19006"]


def test_json_cors_origins(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv(
        "TAMALIFE_CORS_ORIGINS",
        '["https://app.example.com", "https://admin.example.com"]',
    )
    assert Settings().cors_origins == [
        "https://app.example.com",
        "https://admin.example.com",
    ]


def test_postgres_url_uses_asyncpg() -> None:
    settings = Settings(database_url="postgresql://user:password@db.example.com/postgres")
    assert settings.database_url.startswith("postgresql+asyncpg://")


def test_bracket_wrapped_password_is_rejected() -> None:
    with pytest.raises(ValidationError, match="Remove square brackets"):
        Settings(database_url="postgresql://user:[password]@db.example.com/postgres")
