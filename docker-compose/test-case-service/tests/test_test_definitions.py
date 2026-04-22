"""
Tests for test definition endpoints.
"""

import pytest
from httpx import AsyncClient


class TestTestDefinitions:
    """Test test definition API endpoints."""

    async def test_create_test_definition(self, client: AsyncClient, auth_headers: dict):
        """Test creating a new test definition."""
        response = await client.post(
            "/api/v1/test-definitions",
            json={
                "name": "Login Test",
                "description": "Test login functionality",
                "test_id": "login-test-001",
                "url": "https://example.com/login",
                "environment": {"ENV": "test"},
                "tags": ["auth", "smoke"],
                "test_steps": [
                    {
                        "step_number": 1,
                        "description": "Navigate to login page",
                        "type": "navigate",
                        "params": {"url": "https://example.com/login"}
                    }
                ]
            },
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Login Test"
        assert data["test_id"] == "login-test-001"
        assert data["tags"] == ["auth", "smoke"]
        assert len(data["test_steps"]) == 1
        assert "id" in data

    async def test_create_duplicate_test_id(self, client: AsyncClient, auth_headers: dict, sample_test_definition: dict):
        """Test creating test with duplicate test_id fails."""
        response = await client.post(
            "/api/v1/test-definitions",
            json={
                "name": "Another Test",
                "test_id": "sample-test-001",  # Duplicate
                "test_steps": []
            },
            headers=auth_headers
        )

        assert response.status_code == 409

    async def test_list_test_definitions(self, client: AsyncClient, sample_test_definition: dict):
        """Test listing test definitions."""
        response = await client.get("/api/v1/test-definitions")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1

    async def test_list_test_definitions_with_pagination(self, client: AsyncClient, auth_headers: dict):
        """Test pagination."""
        # Create multiple test definitions
        for i in range(5):
            await client.post(
                "/api/v1/test-definitions",
                json={
                    "name": f"Test {i}",
                    "test_id": f"test-{i}",
                    "test_steps": []
                },
                headers=auth_headers
            )

        # Get first page
        response = await client.get("/api/v1/test-definitions?skip=0&limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 3
        assert data["total"] >= 5
        assert data["page"] == 1

    async def test_list_test_definitions_with_search(self, client: AsyncClient, sample_test_definition: dict):
        """Test search functionality."""
        response = await client.get("/api/v1/test-definitions?search=Sample")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert "Sample" in data["items"][0]["name"]

    async def test_list_test_definitions_with_tags(self, client: AsyncClient, sample_test_definition: dict):
        """Test filtering by tags."""
        response = await client.get("/api/v1/test-definitions?tags=smoke")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

    async def test_get_test_definition(self, client: AsyncClient, sample_test_definition: dict):
        """Test getting a specific test definition."""
        test_id = sample_test_definition["test_id"]
        response = await client.get(f"/api/v1/test-definitions/{test_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["test_id"] == test_id
        assert data["name"] == "Sample Test"

    async def test_get_test_definition_not_found(self, client: AsyncClient):
        """Test getting non-existent test definition."""
        response = await client.get("/api/v1/test-definitions/nonexistent")

        assert response.status_code == 404

    async def test_update_test_definition(self, client: AsyncClient, auth_headers: dict, sample_test_definition: dict):
        """Test updating a test definition."""
        test_id = sample_test_definition["test_id"]
        response = await client.put(
            f"/api/v1/test-definitions/{test_id}",
            json={
                "name": "Updated Sample Test",
                "description": "Updated description"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Sample Test"
        assert data["description"] == "Updated description"
        assert data["version"] > 1  # Version should be incremented

    async def test_delete_test_definition(self, client: AsyncClient, auth_headers: dict, sample_test_definition: dict):
        """Test soft deleting a test definition."""
        test_id = sample_test_definition["test_id"]
        response = await client.delete(
            f"/api/v1/test-definitions/{test_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    async def test_list_test_definition_versions(self, client: AsyncClient, auth_headers: dict, sample_test_definition: dict):
        """Test listing versions of a test definition."""
        test_def_id = sample_test_definition["id"]

        # Create a new version by updating
        test_id = sample_test_definition["test_id"]
        await client.put(
            f"/api/v1/test-definitions/{test_id}",
            json={"name": "Updated"},
            headers=auth_headers
        )

        # List versions
        response = await client.get(f"/api/v1/test-definitions/{test_id}/versions")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
