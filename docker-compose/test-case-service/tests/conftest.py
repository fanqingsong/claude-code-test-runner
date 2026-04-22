"""
Pytest configuration and fixtures for test-case-service tests.
"""

import asyncio
import os
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings


# Test database URL (in-memory SQLite for fast tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db():
    """Create test database."""
    # Create test engine
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session_maker = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_maker() as session:
        yield session

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(test_db):
    """Create test client with database override."""

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    """Create authenticated user and return auth headers."""
    # Register test user
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123"
        }
    )

    # Login and get token
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "username": "testuser",
            "password": "testpass123"
        }
    )

    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def sample_test_definition(client: AsyncClient, auth_headers: dict) -> dict:
    """Create a sample test definition."""
    response = await client.post(
        "/api/v1/test-definitions",
        json={
            "name": "Sample Test",
            "description": "A sample test",
            "test_id": "sample-test-001",
            "url": "https://example.com",
            "environment": {"ENV": "test"},
            "tags": ["smoke", "integration"],
            "test_steps": [
                {
                    "step_number": 1,
                    "description": "Navigate to homepage",
                    "type": "navigate",
                    "params": {"url": "https://example.com"}
                },
                {
                    "step_number": 2,
                    "description": "Click login button",
                    "type": "click",
                    "params": {"selector": "#login"}
                }
            ]
        },
        headers=auth_headers
    )

    return response.json()
