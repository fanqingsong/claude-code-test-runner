"""
Schedule Manager Service

Manages synchronization between database schedules and Celery Beat.
"""

import logging
from datetime import datetime, timezone
from typing import List

from croniter import croniter
from celery.schedules import Crontab
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.schedule import Schedule

logger = logging.getLogger(__name__)


class ScheduleManager:
    """
    Manages schedule synchronization to Celery Beat.

    Responsible for:
    - Reading active schedules from database
    - Validating cron expressions
    - Updating Celery Beat configuration
    - Calculating next run times
    """

    def __init__(self, db_session: AsyncSession, celery_app):
        """
        Initialize Schedule Manager.

        Args:
            db_session: Async database session
            celery_app: Celery application instance
        """
        self.db = db_session
        self.celery_app = celery_app

    async def get_active_schedules(self) -> List[Schedule]:
        """
        Retrieve all active schedules from database.

        Returns:
            List of active Schedule objects
        """
        stmt = select(Schedule).where(Schedule.is_active == True)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    def validate_cron(self, cron_expression: str) -> bool:
        """
        Validate cron expression format.

        Args:
            cron_expression: Cron expression to validate

        Returns:
            True if valid, False otherwise
        """
        try:
            # Try to create a croniter instance
            base_time = datetime.now(timezone.utc)
            croniter(cron_expression, base_time)
            return True
        except (ValueError, KeyError):
            return False

    async def update_next_run_time(self, schedule: Schedule) -> None:
        """
        Calculate and update next run time for a schedule.

        Args:
            schedule: Schedule object to update
        """
        try:
            cron = croniter(schedule.cron_expression, datetime.now(timezone.utc))
            next_time = cron.get_next(datetime)
            schedule.next_run_time = next_time
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to calculate next run time for schedule {schedule.id}: {e}")
            raise

    def parse_cron_expression(self, cron_expr: str) -> tuple:
        """
        Parse cron expression into Celery Crontab components.

        Args:
            cron_expr: Standard cron expression (5 fields)

        Returns:
            Tuple of (minute, hour, day_of_month, month_of_year, day_of_week)
        """
        parts = cron_expr.split()
        if len(parts) != 5:
            raise ValueError(f"Cron expression must have 5 parts, got {len(parts)}")

        return tuple(parts)

    async def sync_schedules(self) -> dict:
        """
        Synchronize all active schedules to Celery Beat configuration.

        Returns:
            Dictionary with sync status information
        """
        schedules = await self.get_active_schedules()

        beat_schedule = {}
        skipped = []

        for schedule in schedules:
            # Validate cron expression
            if not self.validate_cron(schedule.cron_expression):
                logger.warning(f"Invalid cron for schedule {schedule.id}: {schedule.cron_expression}")
                skipped.append({
                    'schedule_id': schedule.id,
                    'reason': 'Invalid cron expression'
                })
                continue

            # Build Celery Beat task configuration
            task_name = f"scheduled_test_{schedule.id}"

            try:
                cron_parts = self.parse_cron_expression(schedule.cron_expression)
                beat_schedule[task_name] = {
                    'task': 'app.tasks.test_execution.execute_scheduled_test',
                    'schedule': Crontab(*cron_parts),
                    'args': [schedule.id],
                    'options': {
                        'expires': 300  # Task expires after 5 minutes
                    }
                }

                # Update next run time in database
                await self.update_next_run_time(schedule)

                logger.info(f"Synced schedule {schedule.id} ({schedule.name}) to Celery Beat")

            except Exception as e:
                logger.error(f"Failed to sync schedule {schedule.id}: {e}")
                skipped.append({
                    'schedule_id': schedule.id,
                    'reason': str(e)
                })

        # Apply to Celery configuration
        self.celery_app.conf.beat_schedule = beat_schedule

        logger.info(f"Synced {len(beat_schedule)} schedules to Celery Beat")

        return {
            'synced': len(beat_schedule),
            'skipped': len(skipped),
            'skipped_details': skipped
        }
