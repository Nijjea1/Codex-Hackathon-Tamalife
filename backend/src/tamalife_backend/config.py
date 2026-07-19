from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_prefix="TAMALIFE_",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    environment: Literal["local", "test", "staging", "production"] = "local"
    debug: bool = False
    api_title: str = "Tamalife API"
    api_version: str = "0.1.0"
    api_prefix: str = "/v1"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:8081"]
    )
    trusted_hosts: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1", "test", "testserver"]
    )

    database_url: str = "sqlite+aiosqlite:///./.data/tamalife.db"
    migration_database_url: str | None = None
    database_echo: bool = False
    database_pool_size: int = 5
    database_statement_timeout_ms: int = Field(default=15000, ge=1000, le=120000)
    auto_create_schema: bool = True

    clerk_auth_enabled: bool = True
    clerk_secret_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TAMALIFE_CLERK_SECRET_KEY", "CLERK_SECRET_KEY"),
    )
    clerk_authorized_parties: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "TAMALIFE_CLERK_AUTHORIZED_PARTIES", "CLERK_AUTHORIZED_PARTIES"
        ),
    )
    clerk_webhook_signing_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "TAMALIFE_CLERK_WEBHOOK_SIGNING_SECRET", "CLERK_WEBHOOK_SIGNING_SECRET"
        ),
    )
    clerk_jwt_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TAMALIFE_CLERK_JWT_KEY", "CLERK_JWT_KEY"),
    )
    clerk_deleted_user_policy: Literal["disable", "anonymize"] = "anonymize"

    # Used only when Clerk auth is explicitly disabled for tests/local tooling.
    default_user_id: UUID = UUID("00000000-0000-0000-0000-000000000001")
    default_user_email: str = "demo@tamalife.local"

    openai_api_key: str | None = None
    openai_model: str = "gpt-5.6"
    openai_reasoning_effort: Literal["none", "low", "medium", "high"] = "none"
    extraction_provider: Literal["heuristic", "openai"] = "heuristic"
    extraction_prompt_version: str = "receipt-v1"

    storage_backend: Literal["local", "supabase"] = "local"
    local_storage_root: Path = Path(".data/storage")
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    supabase_storage_bucket: str = "receipts"
    max_upload_bytes: int = 10 * 1024 * 1024
    max_request_body_bytes: int = 12 * 1024 * 1024
    abandoned_receipt_retention_days: int = Field(default=7, ge=1, le=90)
    allowed_upload_types: set[str] = Field(
        default_factory=lambda: {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    )

    redis_url: str = "redis://localhost:6379/0"
    cache_enabled: bool = False
    widget_cache_ttl_seconds: int = 300
    parse_rate_limit_per_minute: int = 10
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    celery_task_soft_time_limit_seconds: int = Field(default=60, ge=5)
    celery_task_time_limit_seconds: int = Field(default=90, ge=10)
    celery_result_expires_seconds: int = Field(default=3600, ge=60)

    reminder_delivery_enabled: bool = False
    reminder_delivery_provider: Literal["log", "webhook"] = "log"
    reminder_delivery_webhook_url: str | None = None
    reminder_delivery_webhook_token: str | None = None
    reminder_max_attempts: int = Field(default=5, ge=1, le=20)
    reminder_retry_base_seconds: int = Field(default=30, ge=1)
    reminder_retry_max_seconds: int = Field(default=3600, ge=1)
    reminder_processing_timeout_seconds: int = Field(default=300, ge=30)
    reminder_scan_interval_seconds: int = Field(default=3600, ge=60)

    widget_token_ttl_days: int = 365
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.0
    log_level: str = "INFO"

    @field_validator("cors_origins", "trusted_hosts", "clerk_authorized_parties", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                import json

                return json.loads(stripped)
            return [part.strip() for part in stripped.split(",") if part.strip()]
        return value

    @field_validator("database_url", "migration_database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        normalized = value.strip()
        if re.search(r":\[[^\]]+\]@", normalized):
            raise ValueError(
                "Remove square brackets around the database password in the connection URL"
            )
        if normalized.startswith("postgres://"):
            return normalized.replace("postgres://", "postgresql+asyncpg://", 1)
        if normalized.startswith("postgresql://"):
            return normalized.replace("postgresql://", "postgresql+asyncpg://", 1)
        return normalized

    @property
    def effective_migration_url(self) -> str:
        return self.migration_database_url or self.database_url

    def validate_runtime(self) -> None:
        if self.extraction_provider == "openai" and not self.openai_api_key:
            raise ValueError("TAMALIFE_OPENAI_API_KEY is required for the OpenAI provider")
        if self.storage_backend == "supabase" and not (
            self.supabase_url and self.supabase_service_key
        ):
            raise ValueError("Supabase URL and service key are required for Supabase storage")
        if self.environment == "production" and self.database_url.startswith("sqlite"):
            raise ValueError("Production must use PostgreSQL, not SQLite")
        if self.max_request_body_bytes <= self.max_upload_bytes:
            raise ValueError("Maximum request size must exceed maximum receipt upload size")
        if self.clerk_auth_enabled and not self.clerk_secret_key:
            raise ValueError("TAMALIFE_CLERK_SECRET_KEY is required when Clerk auth is enabled")
        if self.environment == "production" and not self.clerk_auth_enabled:
            raise ValueError("Clerk authentication cannot be disabled in production")
        if self.environment == "production" and not self.clerk_authorized_parties:
            raise ValueError("Production must configure TAMALIFE_CLERK_AUTHORIZED_PARTIES")
        if self.environment == "production" and not self.clerk_webhook_signing_secret:
            raise ValueError("Production must configure TAMALIFE_CLERK_WEBHOOK_SIGNING_SECRET")
        if self.environment == "production" and (
            self.debug or self.database_echo or self.auto_create_schema
        ):
            raise ValueError("Production disables debug, SQL echo, and automatic schema creation")
        if self.environment == "production" and (
            "*" in self.cors_origins or "*" in self.trusted_hosts
        ):
            raise ValueError("Production CORS origins and trusted hosts must be explicit")
        if self.environment == "production" and {"test", "testserver"}.intersection(
            self.trusted_hosts
        ):
            raise ValueError("Production must configure its real TAMALIFE_TRUSTED_HOSTS")
        if self.environment == "production" and self.storage_backend != "supabase":
            raise ValueError("Production receipt storage must use Supabase")
        if self.environment == "production" and self.extraction_provider != "openai":
            raise ValueError("Production receipt extraction must use OpenAI")
        if (
            self.environment == "production"
            and self.reminder_delivery_enabled
            and self.reminder_delivery_provider != "webhook"
        ):
            raise ValueError("Production reminder delivery must use the webhook provider")
        if self.reminder_delivery_provider == "webhook" and not self.reminder_delivery_webhook_url:
            raise ValueError("The webhook reminder provider requires a delivery URL")
        if self.celery_task_soft_time_limit_seconds >= self.celery_task_time_limit_seconds:
            raise ValueError("Celery soft time limit must be lower than its hard time limit")


@lru_cache
def get_settings() -> Settings:
    return Settings()
