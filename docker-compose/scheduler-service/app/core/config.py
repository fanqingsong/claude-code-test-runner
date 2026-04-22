"""
Application Configuration

Uses pydantic-settings for environment-based configuration.
"""

from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    APP_NAME: str = Field(default="Scheduler Service", description="Application name")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")
    DEBUG: bool = Field(default=False, description="Debug mode")

    # Server
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8002, description="Server port")

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://cc_test_user:changeme@localhost:5432/claude_code_tests",
        description="PostgreSQL database URL"
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://:changeme@localhost:6379/0",
        description="Redis URL for Celery"
    )

    # Celery
    CELERY_BROKER_URL: str = Field(
        default="redis://:changeme@localhost:6379/0",
        description="Celery broker URL"
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://:changeme@localhost:6379/0",
        description="Celery result backend"
    )

    # Security
    SECRET_KEY: str = Field(
        default="changeme-in-production",
        description="Secret key for JWT token signing"
    )
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="Access token expiration time in minutes"
    )

    # CORS
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"],
        description="Allowed CORS origins"
    )

    # Test Execution
    PLAYWRIGHT_HEADLESS: bool = Field(default=True, description="Run Playwright in headless mode")
    SCREENSHOT_DIR: str = Field(default="/app/screenshots", description="Screenshot directory")
    TEST_TIMEOUT: int = Field(default=300000, description="Test execution timeout in milliseconds")

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


# Global settings instance
settings = Settings()
