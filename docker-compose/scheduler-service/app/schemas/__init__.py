"""Pydantic schemas for request/response validation."""

from app.schemas.test_suites import (
    TestSuiteCreate,
    TestSuiteUpdate,
    TestSuiteResponse
)
from app.schemas.schedules import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleToggle,
    SchedulePresetsResponse,
    SchedulePreset,
    ScheduleTriggerResponse
)
from app.schemas.test_generation import (
    TestCaseGenerateRequest,
    TestCaseGenerateResponse,
    BatchGenerateRequest,
    BatchGenerateResponse,
    GeneratedTestCase,
    GeneratedTestStep,
    PromptTemplate,
    GenerationOptions
)

__all__ = [
    "TestSuiteCreate",
    "TestSuiteUpdate",
    "TestSuiteResponse",
    "ScheduleCreate",
    "ScheduleUpdate",
    "ScheduleResponse",
    "ScheduleToggle",
    "SchedulePreset",
    "SchedulePresetsResponse",
    "ScheduleTriggerResponse",
    "TestCaseGenerateRequest",
    "TestCaseGenerateResponse",
    "BatchGenerateRequest",
    "BatchGenerateResponse",
    "GeneratedTestCase",
    "GeneratedTestStep",
    "PromptTemplate",
    "GenerationOptions"
]
