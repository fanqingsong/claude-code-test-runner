"""
Test Execution Tasks

Celery tasks for executing Playwright tests.
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from celery import Task
from playwright.async_api import async_playwright, Browser, Page, BrowserContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import async_session_maker


class DatabaseTask(Task):
    """Base task with database session support."""

    _db = None

    @property
    def db(self) -> AsyncSession:
        """Get or create database session."""
        if self._db is None:
            self._db = async_session_maker()
        return self._db

    def after_return(self, *args, **kwargs):
        """Cleanup after task completion."""
        if self._db:
            asyncio.create_task(self._db.close())
            self._db = None


@celery_app.task(bind=True, base=DatabaseTask, name="app.tasks.test_execution.execute_test")
def execute_test(self, test_definition_id: int, run_id: str, environment: Dict[str, Any] = None):
    """
    Execute a test definition using Playwright.

    Args:
        test_definition_id: Test definition internal ID
        run_id: Unique run identifier
        environment: Environment variables for the test

    Returns:
        dict: Test execution results
    """
    # Run async test execution in event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(
            _execute_test_async(self.db, test_definition_id, run_id, environment or {})
        )
        return result
    finally:
        loop.close()


async def _execute_test_async(
    db: AsyncSession,
    test_definition_id: int,
    run_id: str,
    environment: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Async implementation of test execution.

    Args:
        db: Database session
        test_definition_id: Test definition internal ID
        run_id: Unique run identifier
        environment: Environment variables

    Returns:
        dict: Test execution results
    """
    from sqlalchemy import select
    from app.models.test_definition import TestDefinition, TestStep

    # Fetch test definition with steps
    result = await db.execute(
        select(TestDefinition)
        .where(TestDefinition.id == test_definition_id)
    )
    test_def = result.scalar_one_or_none()

    if not test_def:
        return {
            "status": "error",
            "error": f"Test definition {test_definition_id} not found",
            "run_id": run_id
        }

    # Load test steps
    result = await db.execute(
        select(TestStep)
        .where(TestStep.test_definition_id == test_definition_id)
        .order_by(TestStep.step_number)
    )
    test_steps = result.scalars().all()

    # Execute test
    start_time = datetime.utcnow().timestamp() * 1000  # milliseconds
    test_results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=settings.PLAYWRIGHT_HEADLESS)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # Set default timeout
            page.set_default_timeout(settings.TEST_TIMEOUT)

            # Execute each step
            for step in test_steps:
                step_result = await _execute_step(page, step, environment)
                test_results.append(step_result)

                # Stop on failure
                if step_result["status"] == "failed":
                    break

        except Exception as e:
            test_results.append({
                "step_number": 0,
                "status": "error",
                "error": str(e)
            })

        finally:
            await browser.close()

    end_time = datetime.utcnow().timestamp() * 1000  # milliseconds
    total_duration = end_time - start_time

    # Calculate summary
    passed = sum(1 for r in test_results if r["status"] == "passed")
    failed = sum(1 for r in test_results if r["status"] == "failed")
    total = len(test_results)

    return {
        "run_id": run_id,
        "test_definition_id": test_definition_id,
        "start_time": start_time,
        "end_time": end_time,
        "total_duration": total_duration,
        "total_tests": total,
        "passed": passed,
        "failed": failed,
        "skipped": 0,
        "status": "passed" if failed == 0 else "failed",
        "test_cases": test_results
    }


async def _execute_step(
    page: Page,
    step: "TestStep",
    environment: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Execute a single test step.

    Args:
        page: Playwright page
        step: Test step to execute
        environment: Environment variables

    Returns:
        dict: Step execution result
    """
    step_start = datetime.utcnow().timestamp() * 1000

    try:
        # Get step parameters
        params = step.params.copy()

        # Substitute environment variables
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                env_var = value[2:-1]
                params[key] = environment.get(env_var, value)

        # Execute based on step type
        if step.type == "navigate":
            await page.goto(params["url"])
            await page.wait_for_load_state("networkidle")

        elif step.type == "click":
            await page.click(params["selector"])
            await page.wait_for_load_state("networkidle")

        elif step.type == "fill":
            await page.fill(params["selector"], params["value"])

        elif step.type == "wait":
            await page.wait_for_selector(params["selector"])

        elif step.type == "screenshot":
            screenshot_dir = Path(settings.SCREENSHOT_DIR)
            screenshot_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            screenshot_path = screenshot_dir / f"screenshot_{timestamp}.png"

            await page.screenshot(path=str(screenshot_path))
            return {
                "step_number": step.step_number,
                "description": step.description,
                "status": "passed",
                "screenshot_path": str(screenshot_path),
                "duration": datetime.utcnow().timestamp() * 1000 - step_start
            }

        else:
            return {
                "step_number": step.step_number,
                "description": step.description,
                "status": "failed",
                "error": f"Unknown step type: {step.type}",
                "duration": datetime.utcnow().timestamp() * 1000 - step_start
            }

        # Step passed
        return {
            "step_number": step.step_number,
            "description": step.description,
            "status": "passed",
            "duration": datetime.utcnow().timestamp() * 1000 - step_start
        }

    except Exception as e:
        # Step failed
        return {
            "step_number": step.step_number,
            "description": step.description,
            "status": "failed",
            "error": str(e),
            "duration": datetime.utcnow().timestamp() * 1000 - step_start
        }
