"""
Tests for Celery Beat schedule sync tasks.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession

from app.tasks.schedule_sync import (
    sync_schedules_to_beat,
    execute_scheduled_tests,
    check_overdue_schedules,
    cleanup_old_test_runs,
    setup_beat_schedule
)
from app.models.schedule import Schedule
from app.models.test_run import TestRun


@pytest.mark.asyncio
async def test_sync_schedules_to_beat_multiple_schedules(db_session: AsyncSession):
    """Test syncing multiple active schedules to Celery Beat"""
    from app.tasks.schedule_sync import SyncSessionLocal

    # Create multiple active schedules
    for i in range(3):
        schedule = Schedule(
            name=f"Sync Schedule {i}",
            schedule_type="single",
            test_definition_id=i + 1,
            cron_expression=f"{i} * * * *",
            is_active=True
        )
        db_session.add(schedule)
    await db_session.commit()

    # Mock celery app
    with patch('app.tasks.schedule_sync.celery_app') as mock_celery:
        mock_celery.conf.beat_schedule = {}

        # Run sync
        sync_schedules_to_beat()

        # Verify beat schedule was updated
        assert len(mock_celery.conf.beat_schedule) >= 3
        for task_name, task_config in mock_celery.conf.beat_schedule.items():
            assert "task" in task_config
            assert "schedule" in task_config
            assert task_config["task"] == "app.tasks.schedule_sync.execute_scheduled_tests"


@pytest.mark.asyncio
async def test_sync_schedules_to_beat_inactive_excluded(db_session: AsyncSession):
    """Test that inactive schedules are not synced"""
    # Create active and inactive schedules
    active_schedule = Schedule(
        name="Active Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=True
    )
    inactive_schedule = Schedule(
        name="Inactive Schedule",
        schedule_type="single",
        test_definition_id=2,
        cron_expression="0 10 * * *",
        is_active=False
    )
    db_session.add_all([active_schedule, inactive_schedule])
    await db_session.commit()

    # Mock celery app
    with patch('app.tasks.schedule_sync.celery_app') as mock_celery:
        mock_celery.conf.beat_schedule = {}

        # Run sync
        sync_schedules_to_beat()

        # Verify only active schedule was synced
        assert len(mock_celery.conf.beat_schedule) == 1


@pytest.mark.asyncio
async def test_execute_scheduled_tests_single(db_session: AsyncSession):
    """Test executing a single test schedule"""
    # Create schedule
    schedule = Schedule(
        name="Single Test Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=True
    )
    db_session.add(schedule)
    await db_session.commit()

    # Mock celery send_task
    with patch('app.tasks.schedule_sync.celery_app') as mock_celery:
        mock_celery.send_task = Mock()

        # Execute
        execute_scheduled_tests(schedule.id)

        # Verify task was sent
        mock_celery.send_task.assert_called_once()
        call_args = mock_celery.send_task.call_args
        assert call_args[0][0] == "app.tasks.test_execution.execute_test"
        assert call_args[0][1][0] == 1  # test_definition_id
        assert "run_id" in call_args[0][1][1]

        # Verify schedule last_run_time was updated
        await db_session.refresh(schedule)
        assert schedule.last_run_time is not None


@pytest.mark.asyncio
async def test_execute_scheduled_tests_suite(db_session: AsyncSession, db_session_sync):
    """Test executing a test suite schedule"""
    # Create schedule
    schedule = Schedule(
        name="Suite Schedule",
        schedule_type="suite",
        test_suite_id=1,
        cron_expression="0 9 * * *",
        is_active=True,
        allow_concurrent=True
    )
    db_session.add(schedule)
    await db_session.commit()

    # Mock celery send_task and execution service
    with patch('app.tasks.schedule_sync.celery_app') as mock_celery, \
         patch('app.tasks.schedule_sync.execution_service.resolve_target_tests') as mock_resolve:

        mock_celery.send_task = Mock()
        mock_resolve.return_value = [1, 2, 3]  # Test definition IDs

        # Execute
        execute_scheduled_tests(schedule.id)

        # Verify tasks were sent for all tests
        assert mock_celery.send_task.call_count == 3


@pytest.mark.asyncio
async def test_execute_scheduled_tests_not_found(db_session: AsyncSession):
    """Test executing non-existent schedule"""
    with patch('app.tasks.schedule_sync.celery_app') as mock_celery:
        mock_celery.send_task = Mock()

        # Execute with non-existent ID
        execute_scheduled_tests(99999)

        # Verify no tasks were sent
        mock_celery.send_task.assert_not_called()


@pytest.mark.asyncio
async def test_execute_scheduled_tests_inactive(db_session: AsyncSession):
    """Test that inactive schedules are not executed"""
    # Create inactive schedule
    schedule = Schedule(
        name="Inactive Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=False
    )
    db_session.add(schedule)
    await db_session.commit()

    # Mock celery send_task
    with patch('app.tasks.schedule_sync.celery_app') as mock_celery:
        mock_celery.send_task = Mock()

        # Execute
        execute_scheduled_tests(schedule.id)

        # Verify no tasks were sent
        mock_celery.send_task.assert_not_called()


@pytest.mark.asyncio
async def test_check_overdue_schedules(db_session: AsyncSession):
    """Test checking for overdue schedules"""
    # Create schedule with next_run_time in the past
    schedule = Schedule(
        name="Overdue Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=True,
        next_run_time=datetime.now(timezone.utc) - timedelta(minutes=10)
    )
    db_session.add(schedule)
    await db_session.commit()

    # Mock execute_scheduled_tests.delay
    with patch('app.tasks.schedule_sync.execute_scheduled_tests.delay') as mock_delay:
        # Check
        check_overdue_schedules()

        # Verify execution was triggered
        mock_delay.assert_called_once_with(schedule.id)


@pytest.mark.asyncio
async def test_check_overdue_schedules_future_not_triggered(db_session: AsyncSession):
    """Test that future schedules are not triggered"""
    # Create schedule with next_run_time in the future
    schedule = Schedule(
        name="Future Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(hours=1)
    )
    db_session.add(schedule)
    await db_session.commit()

    # Mock execute_scheduled_tests.delay
    with patch('app.tasks.schedule_sync.execute_scheduled_tests.delay') as mock_delay:
        # Check
        check_overdue_schedules()

        # Verify no execution was triggered
        mock_delay.assert_not_called()


@pytest.mark.asyncio
async def test_cleanup_old_test_runs(db_session: AsyncSession):
    """Test cleaning up old test runs"""
    from sqlalchemy import delete

    # Create old and recent test runs
    old_run = TestRun(
        schedule_id=1,
        run_id="old-run-id",
        status="completed",
        total_tests=5,
        passed=5,
        failed=0,
        skipped=0,
        created_at=datetime.now(timezone.utc) - timedelta(days=60)
    )
    recent_run = TestRun(
        schedule_id=1,
        run_id="recent-run-id",
        status="completed",
        total_tests=5,
        passed=5,
        failed=0,
        skipped=0,
        created_at=datetime.now(timezone.utc) - timedelta(days=10)
    )
    db_session.add_all([old_run, recent_run])
    await db_session.commit()

    # Cleanup (keep 30 days)
    cleanup_old_test_runs(days_to_keep=30)

    # Verify old run was deleted
    result = await db_session.execute(
        select(TestRun).where(TestRun.run_id == "old-run-id")
    )
    assert result.scalar_one_or_none() is None

    # Verify recent run still exists
    result = await db_session.execute(
        select(TestRun).where(TestRun.run_id == "recent-run-id")
    )
    assert result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_cleanup_old_test_runs_custom_days(db_session: AsyncSession):
    """Test cleanup with custom retention period"""
    # Create test runs of various ages
    runs = []
    for days_ago in [5, 15, 25, 35]:
        run = TestRun(
            schedule_id=1,
            run_id=f"run-{days_ago}-days-ago",
            status="completed",
            total_tests=5,
            passed=5,
            failed=0,
            skipped=0,
            created_at=datetime.now(timezone.utc) - timedelta(days=days_ago)
        )
        runs.append(run)
    db_session.add_all(runs)
    await db_session.commit()

    # Cleanup (keep 20 days)
    cleanup_old_test_runs(days_to_keep=20)

    # Verify only recent runs remain
    for days_ago in [5, 15, 25]:
        result = await db_session.execute(
            select(TestRun).where(TestRun.run_id == f"run-{days_ago}-days-ago")
        )
        assert result.scalar_one_or_none() is not None

    # Verify old run was deleted
    result = await db_session.execute(
        select(TestRun).where(TestRun.run_id == "run-35-days-ago")
    )
    assert result.scalar_one_or_none() is None


def test_setup_beat_schedule():
    """Test that beat schedule is configured correctly"""
    from celery.schedules import crontab

    # Setup schedule
    setup_beat_schedule()

    # Verify schedule was configured
    from app.tasks.schedule_sync import celery_app
    assert hasattr(celery_app.conf, 'beat_schedule')

    schedule = celery_app.conf.beat_schedule
    assert "sync-schedules-to-beat" in schedule
    assert "check-overdue-schedules" in schedule
    assert "cleanup-old-test-runs" in schedule

    # Verify task configurations
    assert schedule["sync-schedules-to-beat"]["task"] == "app.tasks.schedule_sync.sync_schedules_to_beat"
    assert schedule["check-overdue-schedules"]["task"] == "app.tasks.schedule_sync.check_overdue_schedules"
    assert schedule["cleanup-old-test-runs"]["task"] == "app.tasks.schedule_sync.cleanup_old_test_runs"
