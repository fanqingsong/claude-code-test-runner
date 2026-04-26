import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_suite import TestSuite


@pytest.mark.asyncio
async def test_create_test_suite(db_session: AsyncSession):
    """Test creating a test suite"""
    suite = TestSuite(
        name="Regression Suite",
        description="Core regression tests",
        test_definition_ids=[1, 2, 3],
        tags={"category": "regression"}
    )

    db_session.add(suite)
    await db_session.commit()
    await db_session.refresh(suite)

    assert suite.id is not None
    assert suite.name == "Regression Suite"
    assert len(suite.test_definition_ids) == 3
    assert suite.tags["category"] == "regression"
    assert suite.created_at is not None


@pytest.mark.asyncio
async def test_test_suite_repr(db_session: AsyncSession):
    """Test TestSuite __repr__ method"""
    suite = TestSuite(
        name="Test Suite",
        test_definition_ids=[1, 2]
    )

    db_session.add(suite)
    await db_session.commit()

    repr_str = repr(suite)
    assert "TestSuite" in repr_str
    assert "Test Suite" in repr_str
