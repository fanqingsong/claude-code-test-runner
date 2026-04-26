from app.core.celery_app import celery_app
from app.services.schedule_manager import ScheduleManager
from app.services.execution_service import ExecutionService
from app.services.test_case_generator import TestCaseGenerator, test_case_generator

# Create service instances
schedule_manager = ScheduleManager(celery_app)
execution_service = ExecutionService()

__all__ = [
    "ScheduleManager",
    "ExecutionService",
    "TestCaseGenerator",
    "schedule_manager",
    "execution_service",
    "test_case_generator"
]
