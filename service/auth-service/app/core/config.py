from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    """Application configuration with environment variable loading"""

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # Security
    SECRET_KEY: str
    JWT_SECRET_KEY: str

    # JWT Configuration
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # SMTP / Email
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAIL_FROM: str
    EMAIL_FROM_NAME: str = "Claude Code Test Runner"

    # Rate Limiting
    RATE_LIMIT_LOGIN_ATTEMPTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 900

    # Session Configuration
    MAX_CONCURRENT_SESSIONS: int = 5
    SESSION_EXPIRE_DAYS: int = 30

    # MFA Configuration
    MFA_ISSUER: str = "ClaudeCodeTestRunner"
    MFA_DIGITS: int = 6
    MFA_PERIOD: int = 30

    # Account Lockout
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

    # Audit Log Retention
    AUDIT_LOG_RETENTION_DAYS: int = 30

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8013",
        "http://localhost:5173",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS from JSON or return as-is"""
        if isinstance(self.CORS_ORIGINS, str):
            try:
                return json.loads(self.CORS_ORIGINS)
            except json.JSONDecodeError:
                return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS


settings = Settings()
