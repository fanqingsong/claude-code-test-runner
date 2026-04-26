"""
Integration tests for API endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_suite import TestSuite
from app.schemas.test_suites import TestSuiteCreate, TestSuiteUpdate


@pytest.mark.asyncio
async def test_create_test_suite(async_client: AsyncClient, db_session: AsyncSession):
    """Test creating a new test suite via API"""
    suite_data = {
        "name": "API Test Suite",
        "description": "Test suite created via API",
        "test_definition_ids": [1, 2, 3, 4],
        "tags": {"category": "api", "priority": "high"}
    }

    response = await async_client.post("/api/v1/test-suites/", json=suite_data)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "API Test Suite"
    assert data["description"] == "Test suite created via API"
    assert data["test_definition_ids"] == [1, 2, 3, 4]
    assert data["tags"]["category"] == "api"
    assert data["tags"]["priority"] == "high"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_test_suite_minimal(async_client: AsyncClient, db_session: AsyncSession):
    """Test creating a test suite with minimal required fields"""
    suite_data = {
        "name": "Minimal Suite",
        "test_definition_ids": [5, 6]
    }

    response = await async_client.post("/api/v1/test-suites/", json=suite_data)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Minimal Suite"
    assert data["test_definition_ids"] == [5, 6]
    assert data["tags"] == {}  # Default empty dict


@pytest.mark.asyncio
async def test_create_test_suite_validation_error(async_client: AsyncClient):
    """Test creating a test suite with invalid data"""
    # Missing required field: test_definition_ids
    suite_data = {
        "name": "Invalid Suite"
    }

    response = await async_client.post("/api/v1/test-suites/", json=suite_data)

    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_list_test_suites(async_client: AsyncClient, db_session: AsyncSession):
    """Test listing all test suites"""
    # Create test suites
    suite1 = TestSuite(
        name="Suite 1",
        description="First suite",
        test_definition_ids=[1, 2],
        tags={"order": "1"}
    )
    suite2 = TestSuite(
        name="Suite 2",
        description="Second suite",
        test_definition_ids=[3, 4],
        tags={"order": "2"}
    )
    db_session.add(suite1)
    db_session.add(suite2)
    await db_session.commit()

    # List suites
    response = await async_client.get("/api/v1/test-suites/")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2

    # Check that suites are returned (newest first by creation date)
    suite_names = [suite["name"] for suite in data]
    assert "Suite 1" in suite_names
    assert "Suite 2" in suite_names


@pytest.mark.asyncio
async def test_list_test_suites_pagination(async_client: AsyncClient, db_session: AsyncSession):
    """Test pagination for listing test suites"""
    # Create multiple test suites
    for i in range(5):
        suite = TestSuite(
            name=f"Suite {i}",
            test_definition_ids=[i],
            tags={"index": str(i)}
        )
        db_session.add(suite)
    await db_session.commit()

    # Test skip and limit
    response = await async_client.get("/api/v1/test-suites/?skip=2&limit=2")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_test_suite(async_client: AsyncClient, db_session: AsyncSession):
    """Test getting a specific test suite"""
    # Create a test suite
    suite = TestSuite(
        name="Get Test Suite",
        description="Suite to retrieve",
        test_definition_ids=[10, 20, 30],
        tags={"type": "retrieval"}
    )
    db_session.add(suite)
    await db_session.commit()
    await db_session.refresh(suite)

    # Get the suite
    response = await async_client.get(f"/api/v1/test-suites/{suite.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == suite.id
    assert data["name"] == "Get Test Suite"
    assert data["description"] == "Suite to retrieve"
    assert data["test_definition_ids"] == [10, 20, 30]
    assert data["tags"]["type"] == "retrieval"


@pytest.mark.asyncio
async def test_get_test_suite_not_found(async_client: AsyncClient):
    """Test getting a non-existent test suite"""
    response = await async_client.get("/api/v1/test-suites/99999")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_test_suite(async_client: AsyncClient, db_session: AsyncSession):
    """Test updating a test suite"""
    # Create a test suite
    suite = TestSuite(
        name="Original Name",
        description="Original description",
        test_definition_ids=[1, 2, 3],
        tags={"version": "1"}
    )
    db_session.add(suite)
    await db_session.commit()
    await db_session.refresh(suite)

    # Update the suite
    update_data = {
        "name": "Updated Name",
        "description": "Updated description",
        "tags": {"version": "2"}
    }
    response = await async_client.put(f"/api/v1/test-suites/{suite.id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == suite.id
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"
    assert data["test_definition_ids"] == [1, 2, 3]  # Unchanged
    assert data["tags"]["version"] == "2"


@pytest.mark.asyncio
async def test_update_test_suite_partial(async_client: AsyncClient, db_session: AsyncSession):
    """Test partial update of a test suite"""
    # Create a test suite
    suite = TestSuite(
        name="Partial Update Suite",
        description="Original",
        test_definition_ids=[1, 2],
        tags={"status": "active"}
    )
    db_session.add(suite)
    await db_session.commit()
    await db_session.refresh(suite)

    # Update only name
    update_data = {
        "name": "New Name Only"
    }
    response = await async_client.put(f"/api/v1/test-suites/{suite.id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name Only"
    assert data["description"] == "Original"  # Unchanged
    assert data["test_definition_ids"] == [1, 2]  # Unchanged
    assert data["tags"]["status"] == "active"  # Unchanged


@pytest.mark.asyncio
async def test_update_test_suite_not_found(async_client: AsyncClient):
    """Test updating a non-existent test suite"""
    update_data = {
        "name": "This should fail"
    }
    response = await async_client.put("/api/v1/test-suites/99999", json=update_data)

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_test_suite(async_client: AsyncClient, db_session: AsyncSession):
    """Test deleting a test suite"""
    # Create a test suite
    suite = TestSuite(
        name="Delete Me Suite",
        test_definition_ids=[1, 2],
        tags={"lifecycle": "temporary"}
    )
    db_session.add(suite)
    await db_session.commit()
    await db_session.refresh(suite)

    suite_id = suite.id

    # Delete the suite
    response = await async_client.delete(f"/api/v1/test-suites/{suite_id}")

    assert response.status_code == 204

    # Verify it's deleted
    get_response = await async_client.get(f"/api/v1/test-suites/{suite_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_test_suite_not_found(async_client: AsyncClient):
    """Test deleting a non-existent test suite"""
    response = await async_client.delete("/api/v1/test-suites/99999")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
