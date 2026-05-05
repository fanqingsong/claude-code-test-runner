"""
Test SSO Configuration

Tests for SSO configuration management (Casdoor settings).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestSSOConfig:
    """Test SSO configuration CRUD operations."""

    async def test_create_sso_config(self, async_client: AsyncClient):
        """Test creating a new SSO configuration."""
        response = await async_client.post(
            "/api/v1/sso/config",
            json={
                "provider": "casdoor",
                "endpoint": "https://casdoor.example.com",
                "client_id": "test-client-id",
                "client_secret": "test-client-secret",
                "organization": "test-org",
                "is_enabled": True
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["provider"] == "casdoor"
        assert data["endpoint"] == "https://casdoor.example.com"
        assert data["client_id"] == "test-client-id"
        assert data["is_enabled"] is True
        assert "id" in data

    async def test_get_sso_config(self, async_client: AsyncClient):
        """Test retrieving SSO configuration."""
        # First create a config
        create_response = await async_client.post(
            "/api/v1/sso/config",
            json={
                "provider": "casdoor",
                "endpoint": "https://casdoor.example.com",
                "client_id": "test-client-id",
                "client_secret": "test-secret",
                "organization": "test-org",
                "is_enabled": True
            }
        )
        config_id = create_response.json()["id"]

        # Get the config
        response = await async_client.get(f"/api/v1/sso/config/{config_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == config_id
        assert data["provider"] == "casdoor"

    async def test_update_sso_config(self, async_client: AsyncClient):
        """Test updating SSO configuration."""
        # Create a config
        create_response = await async_client.post(
            "/api/v1/sso/config",
            json={
                "provider": "casdoor",
                "endpoint": "https://casdoor.example.com",
                "client_id": "test-client-id",
                "client_secret": "test-secret",
                "organization": "test-org",
                "is_enabled": True
            }
        )
        config_id = create_response.json()["id"]

        # Update the config
        response = await async_client.patch(
            f"/api/v1/sso/config/{config_id}",
            json={
                "endpoint": "https://new-casdoor.example.com",
                "is_enabled": False
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["endpoint"] == "https://new-casdoor.example.com"
        assert data["is_enabled"] is False

    async def test_list_sso_configs(self, async_client: AsyncClient):
        """Test listing all SSO configurations."""
        # Create multiple configs
        await async_client.post(
            "/api/v1/sso/config",
            json={
                "provider": "casdoor",
                "endpoint": "https://casdoor1.example.com",
                "client_id": "client-1",
                "client_secret": "secret-1",
                "organization": "org-1",
                "is_enabled": True
            }
        )

        await async_client.post(
            "/api/v1/sso/config",
            json={
                "provider": "casdoor",
                "endpoint": "https://casdoor2.example.com",
                "client_id": "client-2",
                "client_secret": "secret-2",
                "organization": "org-2",
                "is_enabled": False
            }
        )

        # List configs
        response = await async_client.get("/api/v1/sso/config")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 2

    async def test_delete_sso_config(self, async_client: AsyncClient):
        """Test deleting SSO configuration."""
        # Create a config
        create_response = await async_client.post(
            "/api/v1/sso/config",
            json={
                "provider": "casdoor",
                "endpoint": "https://casdoor.example.com",
                "client_id": "test-client-id",
                "client_secret": "test-secret",
                "organization": "test-org",
                "is_enabled": True
            }
        )
        config_id = create_response.json()["id"]

        # Delete the config
        response = await async_client.delete(f"/api/v1/sso/config/{config_id}")

        assert response.status_code == 204

        # Verify it's deleted
        get_response = await async_client.get(f"/api/v1/sso/config/{config_id}")
        assert get_response.status_code == 404
