"""
Test Definitions API Endpoints

CRUD operations for test case definitions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter()


@router.get("/")
async def list_test_definitions(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List all test definitions.

    TODO: Implement in Task 4
    - Query test_definitions table
    - Support pagination (skip/limit)
    - Support filtering by tags, is_active
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )


@router.post("/")
async def create_test_definition(
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new test definition.

    TODO: Implement in Task 4
    - Validate request body
    - Insert into test_definitions table
    - Return created definition
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )


@router.get("/{test_id}")
async def get_test_definition(
    test_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific test definition by test_id.

    TODO: Implement in Task 4
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )


@router.put("/{test_id}")
async def update_test_definition(
    test_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a test definition.

    TODO: Implement in Task 4
    - Create version snapshot before update
    - Update test_definitions table
    - Increment version number
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )


@router.delete("/{test_id}")
async def delete_test_definition(
    test_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a test definition (soft delete by setting is_active=false).

    TODO: Implement in Task 4
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint will be implemented in Task 4"
    )
