"""
Pydantic Schemas for User Management

Request and response models for user CRUD operations.
"""

from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RoleResponse(BaseModel):
    """Schema for role response."""
    id: int
    name: str
    description: Optional[str] = None
    is_system: bool

    model_config = {"from_attributes": True}


class UserBase(BaseModel):
    """Base schema for user."""
    username: str = Field(..., min_length=3, max_length=100, description="Username")
    email: EmailStr = Field(..., description="Email address")


class UserCreate(UserBase):
    """Schema for user creation."""
    password: str = Field(..., min_length=8, max_length=100, description="Password")
    is_active: bool = Field(default=True, description="User active status")


class UserUpdate(BaseModel):
    """Schema for user update."""
    email: Optional[EmailStr] = Field(None, description="Email address")
    is_active: Optional[bool] = Field(None, description="User active status")


class UserResponse(UserBase):
    """Schema for user response."""
    id: int
    is_active: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserWithRoles(UserResponse):
    """Schema for user response with roles."""
    roles: List[RoleResponse] = []

    model_config = {"from_attributes": True}
