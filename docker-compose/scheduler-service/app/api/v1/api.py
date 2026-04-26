"""
API Router Configuration

Aggregates all API endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import jobs, schedules, test_suites

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(
    jobs.router,
    prefix="/jobs",
    tags=["jobs"]
)

api_router.include_router(
    schedules.router,
    prefix="/schedules",
    tags=["schedules"]
)

api_router.include_router(
    test_suites.router,
    prefix="/test-suites",
    tags=["test-suites"]
)
