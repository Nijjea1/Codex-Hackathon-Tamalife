"""Application configuration, loaded from environment variables.

Uses pydantic-settings so every value is typed and validated at startup.
`get_settings()` is cached so the .env file is read once per process.
"""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: str = "development"
    api_v1_prefix: str = "/v1"

    # Clerk
    clerk_secret_key: str = Field(default="", description="Clerk backend Secret Key.")
    clerk_authorized_parties: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # CORS
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    @field_validator("clerk_authorized_parties", "cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Allow comma-separated strings in .env to become lists."""
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
