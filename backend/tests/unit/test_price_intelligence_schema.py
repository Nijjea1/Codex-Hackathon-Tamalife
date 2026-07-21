from __future__ import annotations

from sqlalchemy import CheckConstraint, Enum, UniqueConstraint, Uuid

from tamalife_backend.db.base import Base

PRICE_INTELLIGENCE_TABLES = {
    "providers",
    "provider_aliases",
    "source_discovery_runs",
    "source_candidates",
    "discovery_evidence",
    "pricing_sources",
    "provider_plans",
    "plan_price_history",
    "deals",
    "plan_alternatives",
    "user_plan_matches",
    "user_recommendations",
    "price_intelligence_alerts",
    "source_fetches",
}


def unique_columns(table_name: str) -> set[tuple[str, ...]]:
    return {
        tuple(column.name for column in constraint.columns)
        for constraint in Base.metadata.tables[table_name].constraints
        if isinstance(constraint, UniqueConstraint)
    }


def index_columns(table_name: str) -> set[tuple[str, ...]]:
    return {
        tuple(column.name for column in index.columns)
        for index in Base.metadata.tables[table_name].indexes
    }


def foreign_key_delete_rule(table_name: str, column_name: str) -> str | None:
    foreign_key = next(iter(Base.metadata.tables[table_name].columns[column_name].foreign_keys))
    return foreign_key.ondelete


def check_sql(table_name: str) -> set[str]:
    return {
        str(constraint.sqltext)
        for constraint in Base.metadata.tables[table_name].constraints
        if isinstance(constraint, CheckConstraint)
    }


def test_price_intelligence_tables_use_uuid_ids_and_timestamps() -> None:
    assert PRICE_INTELLIGENCE_TABLES <= set(Base.metadata.tables)
    for table_name in PRICE_INTELLIGENCE_TABLES:
        table = Base.metadata.tables[table_name]
        assert table.primary_key.columns.keys() == ["id"]
        assert isinstance(table.columns.id.type, Uuid)
        assert table.columns.created_at.nullable is False
        assert table.columns.updated_at.nullable is False


def test_discovery_and_catalog_identity_constraints() -> None:
    assert ("slug",) in unique_columns("providers")
    assert ("official_domain",) in unique_columns("providers")
    assert ("provider_id", "normalized_alias") in unique_columns("provider_aliases")
    assert ("idempotency_key",) in unique_columns("source_discovery_runs")
    assert (
        "normalized_url_hash",
        "country",
        "source_type",
    ) in unique_columns("source_candidates")
    assert ("candidate_id", "url") in unique_columns("discovery_evidence")
    assert (
        "normalized_url_hash",
        "country",
        "language",
    ) in unique_columns("pricing_sources")
    assert (
        "provider_id",
        "external_key",
        "country",
        "currency",
        "billing_cycle",
    ) in unique_columns("provider_plans")


def test_history_deals_matches_and_alerts_are_deduplicated() -> None:
    assert ("source_id", "content_hash") in unique_columns("source_fetches")
    assert ("plan_id", "evidence_hash") in unique_columns("plan_price_history")
    assert ("provider_id", "source_id", "fingerprint") in unique_columns("deals")
    assert (
        "source_plan_id",
        "alternative_plan_id",
        "country",
    ) in unique_columns("plan_alternatives")
    assert ("subscription_id", "provider_plan_id") in unique_columns("user_plan_matches")
    assert (
        "user_id",
        "subscription_id",
        "deduplication_key",
    ) in unique_columns("user_recommendations")
    assert ("user_id", "deduplication_key") in unique_columns("price_intelligence_alerts")


def test_operational_queries_have_composite_indexes() -> None:
    assert ("status", "created_at") in index_columns("source_discovery_runs")
    assert ("status", "confidence") in index_columns("source_candidates")
    assert ("status", "next_check_at") in index_columns("pricing_sources")
    assert ("plan_id", "observed_at") in index_columns("plan_price_history")
    assert ("active", "expires_at") in index_columns("deals")
    assert ("user_id", "status", "expires_at") in index_columns("user_recommendations")
    assert ("status", "created_at") in index_columns("price_intelligence_alerts")
    assert ("status", "created_at") in index_columns("source_fetches")


def test_confidence_price_and_retry_database_checks_exist() -> None:
    assert "confidence >= 0 AND confidence <= 1" in check_sql("source_candidates")
    assert "consecutive_failures >= 0" in check_sql("pricing_sources")
    assert "current_price >= 0" in check_sql("provider_plans")
    assert "price >= 0" in check_sql("plan_price_history")
    assert "confidence >= 0 AND confidence <= 1" in check_sql("user_plan_matches")


def test_ownership_and_audit_foreign_keys_have_explicit_delete_rules() -> None:
    assert foreign_key_delete_rule("provider_aliases", "provider_id") == "CASCADE"
    assert foreign_key_delete_rule("source_candidates", "discovery_run_id") == "CASCADE"
    assert foreign_key_delete_rule("pricing_sources", "discovery_candidate_id") == "SET NULL"
    assert foreign_key_delete_rule("provider_plans", "source_id") == "RESTRICT"
    assert foreign_key_delete_rule("source_fetches", "source_id") == "CASCADE"
    assert foreign_key_delete_rule("plan_price_history", "source_fetch_id") == "SET NULL"
    assert foreign_key_delete_rule("user_plan_matches", "user_id") == "CASCADE"
    assert foreign_key_delete_rule("user_recommendations", "target_plan_id") == "SET NULL"
    assert foreign_key_delete_rule("price_intelligence_alerts", "user_id") == "CASCADE"


def test_workflow_state_columns_use_named_enums() -> None:
    expected = {
        ("source_discovery_runs", "status"): "discovery_status",
        ("source_candidates", "status"): "candidate_status",
        ("pricing_sources", "status"): "source_status",
        ("source_fetches", "status"): "source_fetch_status",
        ("plan_price_history", "change_type"): "price_change_type",
        ("user_plan_matches", "status"): "match_status",
        ("user_recommendations", "status"): "recommendation_status",
        ("price_intelligence_alerts", "status"): "price_alert_delivery_status",
    }
    for (table_name, column_name), enum_name in expected.items():
        column_type = Base.metadata.tables[table_name].columns[column_name].type
        assert isinstance(column_type, Enum)
        assert column_type.name == enum_name
