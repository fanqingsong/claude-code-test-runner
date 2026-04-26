"""
TestSuites API Endpoints

Test suite management for organizing and managing test definitions.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.test_suite import TestSuite
from app.schemas.test_suites import TestSuiteCreate, TestSuiteResponse, TestSuiteUpdate

router = APIRouter()


@router.post("/", response_model=TestSuiteResponse, status_code=status.HTTP_201_CREATED)
async def create_test_suite(
    suite_data: TestSuiteCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new test suite.

    - **name**: Suite name (required, 1-255 characters)
    - **description**: Suite description (optional)
    - **test_definition_ids**: List of test definition IDs to include in the suite (required, at least 1)
    - **tags**: Metadata tags for categorization (optional, defaults to empty dict)
    """
    # Create new test suite
    suite = TestSuite(
        name=suite_data.name,
        description=suite_data.description,
        test_definition_ids=suite_data.test_definition_ids,
        tags=suite_data.tags,
        created_by="system"  # TODO: Get from auth context when available
    )

    db.add(suite)
    await db.commit()
    await db.refresh(suite)

    return suite


@router.get("/", response_model=List[TestSuiteResponse])
async def list_test_suites(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List all test suites.

    - **skip**: Number of suites to skip (pagination, defaults to 0)
    - **limit**: Number of suites to return (pagination, defaults to 100, max 1000)

    Returns suites ordered by creation date (newest first).
    """
    # Enforce maximum limit to prevent performance issues
    limit = min(limit, 1000)

    # Query with pagination
    result = await db.execute(
        select(TestSuite)
        .order_by(TestSuite.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    suites = result.scalars().all()

    return suites


@router.get("/{suite_id}", response_model=TestSuiteResponse)
async def get_test_suite(
    suite_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific test suite by ID.

    - **suite_id**: The ID of the test suite to retrieve

    Returns 404 if the suite does not exist.
    """
    result = await db.execute(
        select(TestSuite).where(TestSuite.id == suite_id)
    )
    suite = result.scalar_one_or_none()

    if not suite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test suite with ID {suite_id} not found"
        )

    return suite


@router.put("/{suite_id}", response_model=TestSuiteResponse)
async def update_test_suite(
    suite_id: int,
    suite_data: TestSuiteUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a test suite.

    - **suite_id**: The ID of the test suite to update
    - **name**: New suite name (optional)
    - **description**: New description (optional)
    - **test_definition_ids**: New list of test definition IDs (optional)
    - **tags**: New metadata tags (optional)

    Only updates fields that are provided. Returns 404 if the suite does not exist.
    """
    result = await db.execute(
        select(TestSuite).where(TestSuite.id == suite_id)
    )
    suite = result.scalar_one_or_none()

    if not suite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test suite with ID {suite_id} not found"
        )

    # Update only provided fields
    if suite_data.name is not None:
        suite.name = suite_data.name
    if suite_data.description is not None:
        suite.description = suite_data.description
    if suite_data.test_definition_ids is not None:
        suite.test_definition_ids = suite_data.test_definition_ids
    if suite_data.tags is not None:
        suite.tags = suite_data.tags

    await db.commit()
    await db.refresh(suite)

    return suite


@router.delete("/{suite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_suite(
    suite_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a test suite.

    - **suite_id**: The ID of the test suite to delete

    Returns 204 No Content on success. Returns 404 if the suite does not exist.
    """
    result = await db.execute(
        select(TestSuite).where(TestSuite.id == suite_id)
    )
    suite = result.scalar_one_or_none()

    if not suite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test suite with ID {suite_id} not found"
        )

    await db.delete(suite)
    await db.commit()

    return None
