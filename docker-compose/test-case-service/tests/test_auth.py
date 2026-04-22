"""
Tests for authentication endpoints.
"""

import pytest
from httpx import AsyncClient


class TestAuthentication:
    """Test authentication API endpoints."""

    async def test_register_user(self, client: AsyncClient):
        """Test user registration."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "password123"
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert data["is_active"] is True
        assert "id" in data
        assert "password" not in data

    async def test_register_duplicate_username(self, client: AsyncClient):
        """Test registration with duplicate username fails."""
        # First registration
        await client.post(
            "/api/v1/auth/register",
            json={
                "username": "duplicate",
                "email": "user1@example.com",
                "password": "password123"
            }
        )

        # Second registration with same username
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "duplicate",
                "email": "user2@example.com",
                "password": "password123"
            }
        )

        assert response.status_code == 409

    async def test_register_duplicate_email(self, client: AsyncClient):
        """Test registration with duplicate email fails."""
        # First registration
        await client.post(
            "/api/v1/auth/register",
            json={
                "username": "user1",
                "email": "duplicate@example.com",
                "password": "password123"
            }
        )

        # Second registration with same email
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "user2",
                "email": "duplicate@example.com",
                "password": "password123"
            }
        )

        assert response.status_code == 409

    async def test_register_validation_error(self, client: AsyncClient):
        """Test registration with invalid data."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "ab",  # Too short
                "email": "invalid-email",
                "password": "short"  # Too short
            }
        )

        assert response.status_code == 422  # Validation error

    async def test_login_success(self, client: AsyncClient):
        """Test successful login."""
        # Register user first
        await client.post(
            "/api/v1/auth/register",
            json={
                "username": "loginuser",
                "email": "login@example.com",
                "password": "password123"
            }
        )

        # Login
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "username": "loginuser",
                "password": "password123"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["username"] == "loginuser"

    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "username": "nonexistent",
                "password": "wrongpassword"
            }
        )

        assert response.status_code == 401

    async def test_get_current_user(self, client: AsyncClient, auth_headers: dict):
        """Test getting current user info."""
        response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without token."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401

    async def test_logout(self, client: AsyncClient, auth_headers: dict):
        """Test logout endpoint."""
        response = await client.post(
            "/api/v1/auth/logout",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert "message" in response.json()
