from tamalife_backend.logging import redact_sensitive


def test_redacts_nested_secrets_and_database_passwords() -> None:
    redacted = redact_sensitive(
        None,
        "info",
        {
            "authorization": "Bearer secret-token",
            "nested": {"api_token": "top-secret"},
            "url": "postgresql+asyncpg://user:password@db.example/postgres",
        },
    )
    assert redacted["authorization"] == "[REDACTED]"
    assert redacted["nested"]["api_token"] == "[REDACTED]"
    assert redacted["url"] == "postgresql+asyncpg://user:[REDACTED]@db.example/postgres"
