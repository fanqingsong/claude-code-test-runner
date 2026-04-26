import pytest
from pydantic import ValidationError

from app.schemas.test_suites import TestSuiteCreate, TestSuiteUpdate
from app.schemas.schedules import ScheduleCreate, ScheduleUpdate


def test_test_suite_create_valid():
    """Test valid TestSuiteCreate schema"""
    data = {
        "name": "Regression Suite",
        "description": "Core regression tests",
        "test_definition_ids": [1, 2, 3],
        "tags": {"category": "regression"}
    }

    suite = TestSuiteCreate(**data)
    assert suite.name == "Regression Suite"
    assert len(suite.test_definition_ids) == 3
    assert suite.tags["category"] == "regression"


def test_test_suite_create_empty_name_fails():
    """Test that empty name fails validation"""
    data = {
        "name": "",
        "test_definition_ids": [1]
    }

    with pytest.raises(ValidationError):
        TestSuiteCreate(**data)


def test_test_suite_create_empty_test_ids_fails():
    """Test that empty test_definition_ids fails validation"""
    data = {
        "name": "Test Suite",
        "test_definition_ids": []
    }

    with pytest.raises(ValidationError):
        TestSuiteCreate(**data)


def test_test_suite_update_partial():
    """Test partial update with TestSuiteUpdate"""
    data = {
        "name": "Updated Name"
    }

    update = TestSuiteUpdate(**data)
    assert update.name == "Updated Name"
    assert update.description is None
    assert update.test_definition_ids is None


def test_schedule_create_single_type():
    """Test creating schedule for single test"""
    data = {
        "name": "Daily Test",
        "schedule_type": "single",
        "test_definition_id": 1,
        "cron_expression": "0 9 * * *"
    }

    schedule = ScheduleCreate(**data)
    assert schedule.schedule_type == "single"
    assert schedule.test_definition_id == 1


def test_schedule_create_single_type_missing_id_fails():
    """Test that single type without test_definition_id fails"""
    data = {
        "name": "Daily Test",
        "schedule_type": "single",
        "cron_expression": "0 9 * * *"
    }

    with pytest.raises(ValidationError):
        ScheduleCreate(**data)


def test_schedule_create_suite_type():
    """Test creating schedule for test suite"""
    data = {
        "name": "Weekly Suite",
        "schedule_type": "suite",
        "test_suite_id": 1,
        "cron_expression": "0 9 * * 1",
        "max_retries": 3
    }

    schedule = ScheduleCreate(**data)
    assert schedule.schedule_type == "suite"
    assert schedule.max_retries == 3


def test_schedule_create_invalid_cron_fails():
    """Test that invalid cron expression fails"""
    data = {
        "name": "Test",
        "schedule_type": "single",
        "test_definition_id": 1,
        "cron_expression": "invalid-cron"
    }

    with pytest.raises(ValidationError):
        ScheduleCreate(**data)


def test_schedule_retries_out_of_range():
    """Test that retries outside 0-10 range fails"""
    data = {
        "name": "Test",
        "schedule_type": "single",
        "test_definition_id": 1,
        "cron_expression": "0 9 * * *",
        "max_retries": 15  # Exceeds maximum of 10
    }

    with pytest.raises(ValidationError):
        ScheduleCreate(**data)
