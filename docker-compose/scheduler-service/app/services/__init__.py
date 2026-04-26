from app.services.schedule_manager import ScheduleManager
from app.services.execution_service import ExecutionService
from app.core.celery_app import celery_app

# Create service instances
schedule_manager = ScheduleManager(celery_app)
execution_service = ExecutionService()

__all__ = ["ScheduleManager", "ExecutionService", "schedule_manager", "execution_service"]
