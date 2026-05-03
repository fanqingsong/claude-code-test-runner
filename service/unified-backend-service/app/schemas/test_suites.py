"""
Pydantic Schemas for Test Suite Management
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TestSuiteBase(BaseModel):
    """Base schema for TestSuite"""
    name: str = Field(..., min_length=1, max_length=255, description="Suite name")
    description: Optional[str] = Field(None, description="Suite description")
    test_definition_ids: List[int] = Field(
        ...,
        min_length=1,
        description="List of test definition IDs in this suite"
    )
    tags: dict = Field(default_factory=dict, description="Metadata tags")


class TestSuiteCreate(TestSuiteBase):
    """Schema for creating a new test suite"""
    pass


class TestSuiteUpdate(BaseModel):
    """Schema for updating a test suite"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    test_definition_ids: Optional[List[int]] = Field(None, min_length=1)
    tags: Optional[dict] = None


class TestSuiteResponse(TestSuiteBase):
    """Schema for test suite response"""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: str

    model_config = ConfigDict(from_attributes=True)
