"""
Execution Service

Handles test execution logic for scheduled tasks.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.schedule import Schedule
from app.models.test_run import TestRun
from app.models.test_suite import TestSuite

logger = logging.getLogger(__name__)


class ExecutionService:
    """
    Service for managing test execution for scheduled tasks.

    Responsible for:
    - Resolving target test definitions
    - Checking execution limits
    - Building environment configurations
    - Managing run state
    """

    def __init__(self, db_session: AsyncSession):
        """
        Initialize Execution Service.

        Args:
            db_session: Async database session
        """
        self.db = db_session

    async def resolve_target_tests(self, schedule: Schedule) -> List[int]:
        """
        Resolve target test definition IDs based on schedule type.

        Args:
            schedule: Schedule object

        Returns:
            List of test definition IDs to execute

        Raises:
            ValueError: If schedule_type is unknown
        """
        if schedule.schedule_type == 'single':
            return [schedule.test_definition_id]

        elif schedule.schedule_type == 'suite':
            # Load test suite
            stmt = select(TestSuite).where(TestSuite.id == schedule.test_suite_id)
            result = await self.db.execute(stmt)
            suite = result.scalar_one_or_none()

            if not suite:
                raise ValueError(f"Test suite {schedule.test_suite_id} not found")

            return suite.test_definition_ids

        elif schedule.schedule_type == 'tag_filter':
            # Dynamic tag filtering - query test-case-service
            # For now, return empty as this requires external API call
            logger.warning(f"Tag filter not yet implemented for schedule {schedule.id}")
            return []

        else:
            raise ValueError(f"Unknown schedule_type: {schedule.schedule_type}")

    async def check_execution_limit(self, schedule_id: int) -> bool:
        """
        Check if execution is allowed based on concurrency settings.

        Args:
            schedule_id: Schedule ID to check

        Returns:
            True if execution is allowed, False otherwise
        """
        # Get schedule to check concurrency setting
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await self.db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            return False

        # If concurrent execution is allowed, always return True
        if schedule.allow_concurrent:
            return True

        # Check for running executions
        stmt = select(func.count(TestRun.id)).where(
            TestRun.schedule_id == schedule_id,
            TestRun.status.in_(['pending', 'running'])
        )
        result = await self.db.execute(stmt)
        running_count = result.scalar()

        if running_count > 0:
            logger.info(
                f"Schedule {schedule_id} has {running_count} running executions, "
                "skipping due to concurrency limit"
            )
            return False

        return True

    def build_environment(
        self,
        schedule: Schedule,
        test_definition_environment: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Build final execution environment by merging configurations.

        Args:
            schedule: Schedule object with environment_overrides
            test_definition_environment: Base environment from test definition

        Returns:
            Merged environment dictionary
        """
        base_env = test_definition_environment or {}
        overrides = schedule.environment_overrides or {}

        # Overrides take precedence
        return {**base_env, **overrides}

    async def create_test_run(
        self,
        schedule_id: int,
        test_definition_id: int,
        run_id: str
    ) -> TestRun:
        """
        Create a new test run record.

        Args:
            schedule_id: Schedule ID
            test_definition_id: Test definition ID
            run_id: Unique run identifier

        Returns:
            Created TestRun object
        """
        test_run = TestRun(
            schedule_id=schedule_id,
            test_definition_id=test_definition_id,
            run_id=run_id,
            status='pending'
        )

        self.db.add(test_run)
        await self.db.commit()
        await self.db.refresh(test_run)

        logger.info(f"Created test run {run_id} for schedule {schedule_id}")
        return test_run

    async def update_run_status(
        self,
        run_id: str,
        status: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> TestRun:
        """
        Update test run status and timestamps.

        Args:
            run_id: Run identifier
            status: New status
            start_time: Optional start time
            end_time: Optional end time

        Returns:
            Updated TestRun object

        Raises:
            ValueError: If status transition is invalid
        """
        stmt = select(TestRun).where(TestRun.run_id == run_id)
        result = await self.db.execute(stmt)
        test_run = result.scalar_one_or_none()

        if not test_run:
            raise ValueError(f"Test run {run_id} not found")

        # Validate status transitions
        valid_transitions = {
            'pending': ['running', 'skipped'],
            'running': ['passed', 'failed', 'skipped'],
            'failed': ['pending']  # Only for retry
        }

        current_status = test_run.status
        if status not in valid_transitions.get(current_status, []):
            raise ValueError(
                f"Invalid status transition: {current_status} -> {status}"
            )

        # Update status and timestamps
        test_run.status = status

        if start_time:
            test_run.start_time = start_time

        if end_time:
            test_run.end_time = end_time

        # Calculate duration if both times are present
        if test_run.start_time and test_run.end_time:
            delta = test_run.end_time - test_run.start_time
            test_run.total_duration_ms = int(delta.total_seconds() * 1000)

        await self.db.commit()
        await self.db.refresh(test_run)

        logger.info(f"Updated test run {run_id} status to {status}")
        return test_run

    async def save_test_results(
        self,
        run_id: str,
        results: Dict[str, Any]
    ) -> TestRun:
        """
        Save test execution results to database.

        Args:
            run_id: Run identifier
            results: Test execution results dictionary

        Returns:
            Updated TestRun object
        """
        stmt = select(TestRun).where(TestRun.run_id == run_id)
        result = await self.db.execute(stmt)
        test_run = result.scalar_one_or_none()

        if not test_run:
            raise ValueError(f"Test run {run_id} not found")

        # Update result fields
        test_run.status = results.get('status', 'unknown')
        test_run.total_tests = results.get('total_tests', 0)
        test_run.passed = results.get('passed', 0)
        test_run.failed = results.get('failed', 0)
        test_run.skipped = results.get('skipped', 0)
        test_run.test_cases = results.get('test_cases')
        test_run.error_message = results.get('error')

        # Update end time if not already set
        if not test_run.end_time:
            end_time = datetime.fromtimestamp(results.get('end_time', 0) / 1000)
            test_run.end_time = end_time

            if test_run.start_time:
                delta = end_time - test_run.start_time
                test_run.total_duration_ms = int(delta.total_seconds() * 1000)

        await self.db.commit()
        await self.db.refresh(test_run)

        logger.info(f"Saved results for test run {run_id}: {test_run.status}")
        return test_run
