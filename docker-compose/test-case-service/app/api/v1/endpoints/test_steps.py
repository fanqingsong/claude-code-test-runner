"""
Test Steps API Endpoints

CRUD operations for test steps within test definitions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter()


@router.get("/test-definition/{test_definition_id}")
async def list_test_steps(
    test_definition_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    List all test steps for a test definition.

    TODO: Implement in Task 4
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )


@router.post("/test-definition/{test_definition_id}")
async def create_test_step(
    test_definition_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Add a test step to a test definition.

    TODO: Implement in Task 4
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )


@router.put("/{step_id}")
async def update_test_step(
    step_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a test step.

    TODO: Implement in Task 4
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )


@router.delete("/{step_id}")
async def delete_test_step(
    step_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a test step.

    TODO: Implement in Task 4
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )
