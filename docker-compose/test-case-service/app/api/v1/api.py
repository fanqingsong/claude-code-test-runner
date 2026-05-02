"""
API Router Configuration

Aggregates all API endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    test_definitions,
    test_steps,
    test_versions,
    users,
)

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["authentication"]
)

api_router.include_router(
    test_definitions.router,
    prefix="/test-definitions",
    tags=["test-definitions"]
)

api_router.include_router(
    test_steps.router,
    prefix="/test-steps",
    tags=["test-steps"]
)

api_router.include_router(
    test_versions.router,
    prefix="/test-versions",
    tags=["test-versions"]
)

api_router.include_router(
    users.router,
    tags=["users"]
)
