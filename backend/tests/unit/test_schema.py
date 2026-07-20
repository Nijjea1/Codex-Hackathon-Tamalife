from sqlalchemy import UniqueConstraint

from tamalife_backend.db.base import Base


def unique_columns(table_name: str) -> set[tuple[str, ...]]:
    table = Base.metadata.tables[table_name]
    return {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }


def test_required_application_tables_are_in_alembic_metadata() -> None:
    assert {
        "users",
        "subscriptions",
        "subscription_events",
        "parsed_receipts",
        "notification_preferences",
        "idempotency_keys",
        "widget_tokens",
        "clerk_webhook_events",
    } <= set(Base.metadata.tables)


def test_widget_tokens_store_only_hashes() -> None:
    columns = set(Base.metadata.tables["widget_tokens"].columns.keys())
    assert "token_hash" in columns
    assert "token" not in columns


def test_users_store_a_unique_clerk_identity() -> None:
    table = Base.metadata.tables["users"]
    assert "clerk_user_id" in table.columns
    assert any(
        index.unique and tuple(column.name for column in index.columns) == ("clerk_user_id",)
        for index in table.indexes
    )
    assert {"display_name", "image_url", "disabled_at", "deleted_at"} <= set(table.columns.keys())


def test_idempotency_and_delivery_constraints_are_unique() -> None:
    assert ("user_id", "scope", "key") in unique_columns("idempotency_keys")
    assert ("subscription_id", "idempotency_key") in unique_columns("subscription_events")
    assert ("clerk_event_id",) in unique_columns("clerk_webhook_events")
