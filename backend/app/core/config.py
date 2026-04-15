from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HAR Backend"
    api_v1_prefix: str = ""
    debug: bool = False

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "har_backend"

    jwt_secret_key: str = Field(default="change-this-secret-in-env-please", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]

        if isinstance(value, str):
            candidate = value.strip()
            if not candidate:
                return ["*"]

            if candidate.startswith("["):
                parsed = json.loads(candidate)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]

            return [item.strip() for item in candidate.split(",") if item.strip()]

        return ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
