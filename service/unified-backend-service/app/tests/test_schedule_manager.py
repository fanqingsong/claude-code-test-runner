import pytest
from unittest.mock import Mock, MagicMock
from datetime import timezone, datetime

from app.services.schedule_manager import ScheduleManager
from app.models.schedule import Schedule


@pytest.mark.asyncio
async def test_get_active_schedules(db_session):
    """Test retrieving active schedules"""
    # Create test schedules
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

    db_session.add(active_schedule)
    db_session.add(inactive_schedule)
    await db_session.commit()

    # Test
    mock_celery = Mock()
    manager = ScheduleManager(db_session, mock_celery)
    active_schedules = await manager.get_active_schedules()

    assert len(active_schedules) == 1
    assert active_schedules[0].name == "Active Schedule"


def test_validate_cron_valid():
    """Test cron validation with valid expressions"""
    manager = ScheduleManager(None, None)

    assert manager.validate_cron("0 9 * * *") is True
    assert manager.validate_cron("*/5 * * * *") is True
    assert manager.validate_cron("0 9 * * 1") is True


def test_validate_cron_invalid():
    """Test cron validation with invalid expressions"""
    manager = ScheduleManager(None, None)

    assert manager.validate_cron("invalid") is False
    assert manager.validate_cron("60 * * * *") is False  # Invalid minute


def test_parse_cron_expression():
    """Test parsing cron expression"""
    manager = ScheduleManager(None, None)

    parts = manager.parse_cron_expression("0 9 * * 1")
    assert parts == ("0", "9", "*", "*", "1")


def test_parse_cron_expression_invalid():
    """Test parsing invalid cron expression"""
    manager = ScheduleManager(None, None)

    with pytest.raises(ValueError):
        manager.parse_cron_expression("0 9 * *")  # Only 4 parts


@pytest.mark.asyncio
async def test_update_next_run_time(db_session):
    """Test updating next run time"""
    from datetime import timezone
    from unittest.mock import Mock

    schedule = Schedule(
        name="Test Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=True
    )

    db_session.add(schedule)
    await db_session.commit()

    mock_celery = Mock()
    manager = ScheduleManager(db_session, mock_celery)

    # Should update next_run_time
    await manager.update_next_run_time(schedule)

    assert schedule.next_run_time is not None
    # Verify it's in the future
    assert schedule.next_run_time > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_sync_schedules(db_session):
    """Test syncing schedules to Celery Beat"""
    from unittest.mock import Mock

    # Create active schedule
    schedule = Schedule(
        name="Test Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=True
    )

    db_session.add(schedule)
    await db_session.commit()

    mock_celery = Mock()
    mock_celery.conf = Mock()
    manager = ScheduleManager(db_session, mock_celery)

    result = await manager.sync_schedules()

    assert result['synced'] == 1
    assert result['skipped'] == 0
    assert 'next_run_time' in result  # Should be updated
    assert mock_celery.conf.beat_schedule is not None
