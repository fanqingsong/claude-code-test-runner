"""
Pydantic Schemas for Schedule Management

Request and response models for test schedules.
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ScheduleCreate(BaseModel):
    """Schema for creating a new schedule."""
    name: str = Field(..., min_length=1, max_length=255, description="Schedule name")
    test_definition_ids: List[int] = Field(..., description="List of test definition IDs to execute")
    cron_expression: str = Field(..., description="Cron expression for scheduling")
    environment: dict = Field(default_factory=dict, description="Environment variables for tests")
    is_active: bool = Field(default=True, description="Whether the schedule is active")


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    test_definition_ids: Optional[List[int]] = None
    cron_expression: Optional[str] = None
    environment: Optional[dict] = None
    is_active: Optional[bool] = None


class ScheduleResponse(BaseModel):
    """Schema for schedule response."""
    id: int
    name: str
    test_definition_ids: List[int]
    cron_expression: str
    environment: dict
    is_active: bool
    next_run_time: Optional[datetime]
    last_run_time: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}
