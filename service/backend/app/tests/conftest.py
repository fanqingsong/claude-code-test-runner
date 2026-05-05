"""
Pytest configuration and fixtures for testing.
"""

import asyncio
import pytest
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

from app.core.database import Base
from app.main import app


# Test database URL (in-memory SQLite for tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(engine) -> AsyncSession:
    """Create test database session."""
    async_session_maker = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_maker() as session:
        yield session


@pytest.fixture(scope="function")
async def async_client(db_session: AsyncSession) -> AsyncClient:
    """Create async HTTP client for testing API endpoints."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client


@pytest.fixture(scope="function")
async def admin_token(async_client: AsyncClient) -> str:
    """Create an admin user and return access token."""
    # Register admin user
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "admin",
            "email": "admin@test.com",
            "password": "admin123"
        }
    )

    # Login to get token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "username": "admin",
            "password": "admin123"
        }
    )

    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="function")
async def user_token(async_client: AsyncClient) -> str:
    """Create a regular user and return access token."""
    # Register regular user
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "testuser",
            "email": "user@test.com",
            "password": "user123"
        }
    )

    # Login to get token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "username": "testuser",
            "password": "user123"
        }
    )

    data = response.json()
    return data["access_token"]
