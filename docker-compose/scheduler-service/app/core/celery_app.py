"""
Celery Application Configuration

Configures Celery for distributed task queue with Redis broker.
"""

from celery import Celery

from app.core.config import settings

# Create Celery application
celery_app = Celery(
    "scheduler_service",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.test_execution"]
)

# Configure Celery
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task routing
    task_routes={
        "app.tasks.test_execution.execute_test": {"queue": "test_execution"},
    },

    # Worker settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,

    # Task result settings
    result_expires=3600,  # 1 hour
    task_track_started=True,

    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Scheduled tasks (will be configured dynamically)
celery_app.conf.beat_schedule = {
    "example-scheduled-task": {
        "task": "app.tasks.test_execution.execute_test",
        "schedule": 60.0,  # Every 60 seconds (example)
    },
}

# Configure beat schedule with periodic tasks
def _configure_beat_schedule():
    """Configure Celery Beat with periodic tasks."""
    from app.tasks.schedule_sync import setup_beat_schedule
    setup_beat_schedule()

# Call during module initialization
_configure_beat_schedule()
