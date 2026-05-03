import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.execution_service import ExecutionService
from app.models.schedule import Schedule
from app.models.test_suite import TestSuite


@pytest.mark.asyncio
async def test_resolve_single_test(db_session: AsyncSession):
    """Test resolving single test type"""
    schedule = Schedule(
        name="Single Test",
        schedule_type="single",
        test_definition_id=5,
        cron_expression="0 9 * * *"
    )

    service = ExecutionService(db_session)
    test_ids = await service.resolve_target_tests(schedule)

    assert test_ids == [5]


@pytest.mark.asyncio
async def test_resolve_suite_tests(db_session: AsyncSession):
    """Test resolving suite test type"""
    # Create test suite
    suite = TestSuite(
        name="Test Suite",
        test_definition_ids=[1, 2, 3]
    )

    db_session.add(suite)
    await db_session.commit()

    # Create schedule for suite
    schedule = Schedule(
        name="Suite Schedule",
        schedule_type="suite",
        test_suite_id=suite.id,
        cron_expression="0 9 * * *"
    )

    service = ExecutionService(db_session)
    test_ids = await service.resolve_target_tests(schedule)

    assert test_ids == [1, 2, 3]


@pytest.mark.asyncio
async def test_check_execution_limit_allow_concurrent(db_session: AsyncSession):
    """Test execution check with concurrent allowed"""
    schedule = Schedule(
        name="Concurrent Test",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        allow_concurrent=True
    )

    db_session.add(schedule)
    await db_session.commit()

    service = ExecutionService(db_session)
    result = await service.check_execution_limit(schedule.id)

    assert result is True


@pytest.mark.asyncio
async def test_build_environment_merge(db_session: AsyncSession):
    """Test environment configuration merging"""
    schedule = Schedule(
        name="Test",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        environment_overrides={
            "BASE_URL": "https://staging.example.com",
            "TIMEOUT": "30"
        }
    )

    service = ExecutionService(db_session)
    test_env = {"BASE_URL": "https://dev.example.com", "DEBUG": "false"}

    merged = service.build_environment(schedule, test_env)

    assert merged["BASE_URL"] == "https://staging.example.com"  # Overridden
    assert merged["DEBUG"] == "false"  # From base
    assert merged["TIMEOUT"] == "30"  # From override


@pytest.mark.asyncio
async def test_create_test_run(db_session: AsyncSession):
    """Test creating a test run"""
    service = ExecutionService(db_session)

    test_run = await service.create_test_run(
        schedule_id=1,
        test_definition_id=1,
        run_id="test_run_123"
    )

    assert test_run.id is not None
    assert test_run.run_id == "test_run_123"
    assert test_run.status == "pending"


@pytest.mark.asyncio
async def test_update_run_status_valid_transition(db_session: AsyncSession):
    """Test valid status transition"""
    service = ExecutionService(db_session)

    # Create test run
    test_run = await service.create_test_run(1, 1, "test_run_456")

    # Update to running
    updated = await service.update_run_status("test_run_456", "running")

    assert updated.status == "running"
    assert updated.start_time is not None


@pytest.mark.asyncio
async def test_update_run_status_invalid_transition(db_session: AsyncSession):
    """Test invalid status transition"""
    service = ExecutionService(db_session)

    # Create test run
    test_run = await service.create_test_run(1, 1, "test_run_789")

    # Try invalid transition: pending -> passed
    with pytest.raises(ValueError, match="Invalid status transition"):
        await service.update_run_status("test_run_789", "passed")
