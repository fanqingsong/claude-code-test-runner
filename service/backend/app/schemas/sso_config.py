"""
SSO Configuration Schemas

Pydantic schemas for SSO configuration validation and serialization.
"""

from datetime import datetime
from pydantic import BaseModel, Field, field_validator, HttpUrl
from typing import Optional


class SSOConfigBase(BaseModel):
    """Base SSO configuration schema."""

    provider: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="SSO provider name (e.g., 'casdoor', 'auth0', 'okta')"
    )
    endpoint: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="SSO provider endpoint URL (e.g., 'https://casdoor.example.com')"
    )
    client_id: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="OAuth client ID"
    )
    client_secret: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="OAuth client secret"
    )
    organization: Optional[str] = Field(
        None,
        max_length=255,
        description="Organization name"
    )
    is_enabled: bool = Field(
        True,
        description="Whether this SSO config is enabled"
    )

    @field_validator('endpoint')
    @classmethod
    def validate_endpoint(cls, v: str) -> str:
        """Validate that endpoint is a valid URL."""
        if not v.startswith(('http://', 'https://')):
            raise ValueError('Endpoint must start with http:// or https://')
        # Remove trailing slash
        v = v.rstrip('/')
        return v

    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v: str) -> str:
        """Validate and normalize provider name."""
        allowed_providers = ['casdoor', 'auth0', 'okta', 'azure', 'google']
        v_lower = v.lower().strip()
        if v_lower not in allowed_providers:
            raise ValueError(f'Provider must be one of: {", ".join(allowed_providers)}')
        return v_lower


class SSOConfigCreate(SSOConfigBase):
    """Schema for creating SSO configuration."""

    pass


class SSOConfigUpdate(BaseModel):
    """Schema for updating SSO configuration."""

    endpoint: Optional[str] = Field(None, min_length=10, max_length=500)
    client_id: Optional[str] = Field(None, min_length=1, max_length=255)
    client_secret: Optional[str] = Field(None, min_length=1, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)
    is_enabled: Optional[bool] = None

    @field_validator('endpoint')
    @classmethod
    def validate_endpoint(cls, v: Optional[str]) -> Optional[str]:
        """Validate that endpoint is a valid URL if provided."""
        if v is not None:
            if not v.startswith(('http://', 'https://')):
                raise ValueError('Endpoint must start with http:// or https://')
            v = v.rstrip('/')
        return v


class SSOConfigResponse(SSOConfigBase):
    """Schema for SSO configuration response."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SSOConfigListResponse(BaseModel):
    """Schema for SSO configuration list response."""

    items: list[SSOConfigResponse]
    total: int
