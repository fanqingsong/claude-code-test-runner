"""
Test Definitions API Endpoints

CRUD operations for test case definitions.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import TestDefinition, TestStep, TestVersion
from app.schemas import (
    TestDefinitionCreate,
    TestDefinitionResponse,
    TestDefinitionUpdate,
    TestDefinitionListResponse,
    TestVersionSnapshot,
)

router = APIRouter()


@router.get("/", response_model=TestDefinitionListResponse)
async def list_test_definitions(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Number of items to return"),
    search: Optional[str] = Query(None, description="Search in name, description, or test_id"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all test definitions with pagination and filtering.

    - **skip**: Number of items to skip (for pagination)
    - **limit**: Number of items to return (max 500)
    - **search**: Search term for name, description, or test_id
    - **tags**: Filter by tags (comma-separated)
    - **is_active**: Filter by active status
    """
    # Build query
    query = select(TestDefinition)

    # Apply filters
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                TestDefinition.name.ilike(search_pattern),
                TestDefinition.description.ilike(search_pattern),
                TestDefinition.test_id.ilike(search_pattern)
            )
        )

    if tags:
        # Filter by tags (any match)
        query = query.where(TestDefinition.tags.overlap(tags))

    if is_active is not None:
        query = query.where(TestDefinition.is_active == is_active)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination and ordering
    query = query.order_by(TestDefinition.created_at.desc()).offset(skip).limit(limit)

    # Execute query
    result = await db.execute(query.options(selectinload(TestDefinition.test_steps)))
    test_definitions = result.scalars().all()

    # Calculate pagination metadata
    page = skip // limit + 1
    total_pages = (total + limit - 1) // limit

    return TestDefinitionListResponse(
        items=test_definitions,
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages
    )


@router.post("/", response_model=TestDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_test_definition(
    test_def: TestDefinitionCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new test definition.

    - **name**: Test name
    - **description**: Test description
    - **test_id**: Unique test identifier
    - **url**: Base URL for test
    - **environment**: Environment variables
    - **tags**: Test tags
    - **test_steps**: List of test steps
    """
    # Check if test_id already exists
    existing = await db.execute(
        select(TestDefinition).where(TestDefinition.test_id == test_def.test_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Test definition with test_id '{test_def.test_id}' already exists"
        )

    # Create test definition
    db_test_def = TestDefinition(
        name=test_def.name,
        description=test_def.description,
        test_id=test_def.test_id,
        url=test_def.url,
        environment=test_def.environment,
        tags=test_def.tags,
        created_by="system",  # TODO: Get from JWT token in Task 5
    )

    # Add test steps
    for step_data in test_def.test_steps:
        step = TestStep(
            step_number=step_data.step_number,
            description=step_data.description,
            type=step_data.type,
            params=step_data.params,
            expected_result=step_data.expected_result
        )
        db_test_def.test_steps.append(step)

    db.add(db_test_def)
    await db.commit()
    await db.refresh(db_test_def)

    # Load test steps for response
    result = await db.execute(
        select(TestDefinition)
        .options(selectinload(TestDefinition.test_steps))
        .where(TestDefinition.id == db_test_def.id)
    )
    return result.scalar_one()


@router.get("/{test_id}", response_model=TestDefinitionResponse)
async def get_test_definition(
    test_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific test definition by test_id.

    - **test_id**: Unique test identifier
    """
    result = await db.execute(
        select(TestDefinition)
        .options(selectinload(TestDefinition.test_steps))
        .where(TestDefinition.test_id == test_id)
    )
    test_def = result.scalar_one_or_none()

    if not test_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test definition with test_id '{test_id}' not found"
        )

    return test_def


@router.put("/{test_id}", response_model=TestDefinitionResponse)
async def update_test_definition(
    test_id: str,
    test_def_update: TestDefinitionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a test definition.

    Creates a version snapshot before updating.

    - **test_id**: Unique test identifier
    - **name**: Updated test name
    - **description**: Updated test description
    - **url**: Updated base URL
    - **environment**: Updated environment variables
    - **tags**: Updated test tags
    - **is_active**: Updated active status
    """
    # Get existing test definition
    result = await db.execute(
        select(TestDefinition)
        .options(selectinload(TestDefinition.test_steps))
        .where(TestDefinition.test_id == test_id)
    )
    test_def = result.scalar_one_or_none()

    if not test_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test definition with test_id '{test_id}' not found"
        )

    # Create version snapshot
    snapshot_data = TestDefinitionResponse.model_validate(test_def).model_dump()
    version = TestVersion(
        test_definition_id=test_def.id,
        version=test_def.version,
        snapshot=snapshot_data,
        change_description="Update before modification",
        created_by="system"  # TODO: Get from JWT token in Task 5
    )
    db.add(version)

    # Update fields
    update_data = test_def_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(test_def, field, value)

    # Increment version
    test_def.version += 1

    await db.commit()
    await db.refresh(test_def)

    # Reload with test steps
    result = await db.execute(
        select(TestDefinition)
        .options(selectinload(TestDefinition.test_steps))
        .where(TestDefinition.id == test_def.id)
    )
    return result.scalar_one()


@router.delete("/{test_id}", response_model=TestDefinitionResponse)
async def delete_test_definition(
    test_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Soft delete a test definition (sets is_active=False).

    - **test_id**: Unique test identifier
    """
    # Get existing test definition
    result = await db.execute(
        select(TestDefinition)
        .options(selectinload(TestDefinition.test_steps))
        .where(TestDefinition.test_id == test_id)
    )
    test_def = result.scalar_one_or_none()

    if not test_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test definition with test_id '{test_id}' not found"
        )

    # Soft delete
    test_def.is_active = False
    await db.commit()
    await db.refresh(test_def)

    return test_def


@router.get("/{test_id}/versions", response_model=List[TestVersionSnapshot])
async def list_test_definition_versions(
    test_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    List all versions of a test definition.

    - **test_id**: Unique test identifier
    """
    # Get test definition
    result = await db.execute(
        select(TestDefinition).where(TestDefinition.test_id == test_id)
    )
    test_def = result.scalar_one_or_none()

    if not test_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test definition with test_id '{test_id}' not found"
        )

    # Get versions
    result = await db.execute(
        select(TestVersion)
        .where(TestVersion.test_definition_id == test_def.id)
        .order_by(TestVersion.version.desc())
    )
    versions = result.scalars().all()

    return versions
