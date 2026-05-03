import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_suite import TestSuite
from app.models.schedule import Schedule
from app.models.test_run import TestRun


@pytest.mark.asyncio
async def test_create_test_suite(db_session: AsyncSession):
    """Test creating a test suite"""
    suite = TestSuite(
        name="Regression Suite",
        description="Core regression tests",
        test_definition_ids=[1, 2, 3],
        tags={"category": "regression"}
    )

    db_session.add(suite)
    await db_session.commit()
    await db_session.refresh(suite)

    assert suite.id is not None
    assert suite.name == "Regression Suite"
    assert len(suite.test_definition_ids) == 3
    assert suite.tags["category"] == "regression"
    assert suite.created_at is not None


@pytest.mark.asyncio
async def test_test_suite_repr(db_session: AsyncSession):
    """Test TestSuite __repr__ method"""
    suite = TestSuite(
        name="Test Suite",
        test_definition_ids=[1, 2]
    )

    db_session.add(suite)
    await db_session.commit()

    repr_str = repr(suite)
    assert "TestSuite" in repr_str
    assert "Test Suite" in repr_str


@pytest.mark.asyncio
async def test_create_schedule(db_session: AsyncSession):
    """Test creating a schedule"""
    schedule = Schedule(
        name="Daily Regression",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        timezone="UTC",
        is_active=True,
        allow_concurrent=False,
        max_retries=2
    )

    db_session.add(schedule)
    await db_session.commit()
    await db_session.refresh(schedule)

    assert schedule.id is not None
    assert schedule.name == "Daily Regression"
    assert schedule.schedule_type == "single"
    assert schedule.cron_expression == "0 9 * * *"
    assert schedule.is_active is True
    assert schedule.max_retries == 2


@pytest.mark.asyncio
async def test_schedule_suite_type(db_session: AsyncSession):
    """Test schedule with suite type"""
    schedule = Schedule(
        name="Weekly Suite Run",
        schedule_type="suite",
        test_suite_id=1,
        cron_expression="0 9 * * 1",
        environment_overrides={"BASE_URL": "https://staging.example.com"}
    )

    db_session.add(schedule)
    await db_session.commit()

    assert schedule.schedule_type == "suite"
    assert schedule.environment_overrides["BASE_URL"] == "https://staging.example.com"


@pytest.mark.asyncio
async def test_create_test_run(db_session: AsyncSession):
    """Test creating a test run"""
    run = TestRun(
        schedule_id=1,
        test_definition_id=1,
        run_id="schedule_1_test_1_1234567890",
        status="passed",
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow(),
        total_duration_ms=45000,
        total_tests=10,
        passed=10,
        failed=0,
        skipped=0
    )

    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    assert run.id is not None
    assert run.status == "passed"
    assert run.total_tests == 10
    assert run.passed == 10
    assert run.failed == 0


@pytest.mark.asyncio
async def test_test_run_with_failure(db_session: AsyncSession):
    """Test test run with failure details"""
    run = TestRun(
        schedule_id=1,
        run_id="failed_run_123",
        status="failed",
        error_message="Element not found: #submit-button",
        test_cases=[
            {"step_number": 1, "status": "passed"},
            {"step_number": 2, "status": "failed", "error": "Element not found"}
        ]
    )

    db_session.add(run)
    await db_session.commit()

    assert run.status == "failed"
    assert run.error_message is not None
    assert run.test_cases is not None
    assert len(run.test_cases) == 2


