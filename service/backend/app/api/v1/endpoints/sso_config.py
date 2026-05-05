"""
SSO Configuration API Endpoints

CRUD operations for SSO provider configurations.
All endpoints require admin authentication.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models import SSOConfig, User
from app.schemas import (
    SSOConfigCreate,
    SSOConfigUpdate,
    SSOConfigResponse,
    SSOConfigListResponse,
)

router = APIRouter()


@router.post("/config", response_model=SSOConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_sso_config(
    config_data: SSOConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Create a new SSO configuration.

    Requires admin authentication.

    - **provider**: SSO provider name (e.g., 'casdoor')
    - **endpoint**: SSO provider endpoint URL
    - **client_id**: OAuth client ID
    - **client_secret**: OAuth client secret
    - **organization**: Organization name (optional)
    - **is_enabled**: Whether this SSO config is enabled
    """
    config = SSOConfig(**config_data.model_dump())
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return config


@router.get("/config", response_model=SSOConfigListResponse)
async def list_sso_configs(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    List all SSO configurations.

    Requires admin authentication.
    """
    result = await db.execute(select(SSOConfig))
    configs = result.scalars().all()

    return SSOConfigListResponse(
        items=[SSOConfigResponse.model_validate(config) for config in configs],
        total=len(configs)
    )


@router.get("/config/{config_id}", response_model=SSOConfigResponse)
async def get_sso_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get a specific SSO configuration by ID.

    Requires admin authentication.
    """
    result = await db.execute(select(SSOConfig).where(SSOConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO configuration not found"
        )

    return config


@router.patch("/config/{config_id}", response_model=SSOConfigResponse)
async def update_sso_config(
    config_id: int,
    config_data: SSOConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Update an SSO configuration.

    Requires admin authentication.
    Only updates fields that are provided.
    """
    result = await db.execute(select(SSOConfig).where(SSOConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO configuration not found"
        )

    # Update only provided fields
    update_data = config_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)

    return config


@router.delete("/config/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sso_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Delete an SSO configuration.

    Requires admin authentication.
    """
    result = await db.execute(select(SSOConfig).where(SSOConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO configuration not found"
        )

    await db.delete(config)
    await db.commit()

    return None
