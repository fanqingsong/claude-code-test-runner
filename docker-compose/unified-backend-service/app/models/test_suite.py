"""
Test Suite ORM Model

Represents a static group of test definitions that can be scheduled together.
"""

from datetime import datetime
from typing import List

from sqlalchemy import ARRAY, DateTime, func, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TestSuite(Base):
    """
    Test Suite Model

    Represents a static collection of test definitions that can be
    scheduled and executed together.
    """

    __tablename__ = "test_suites"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Basic fields
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    test_definition_ids: Mapped[List[int]] = mapped_column(
        ARRAY(Integer),
        nullable=False,
        default=list
    )

    # Metadata
    tags: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=func.now()
    )
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)

    def __repr__(self) -> str:
        return f"<TestSuite(id={self.id}, name='{self.name}', tests={len(self.test_definition_ids)})>"
