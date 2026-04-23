"""
Test Definition ORM Model

Represents a test case definition with metadata, steps, and versions.
"""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ARRAY, Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.test_step import TestStep
    from app.models.test_version import TestVersion


class TestDefinition(Base):
    """
    Test Definition Model

    Represents a complete test case with metadata, environment configuration,
    and associated test steps.
    """

    __tablename__ = "test_definitions"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Basic fields
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    test_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # JSON fields
    environment: Mapped[dict] = mapped_column(JSONB, default={}, nullable=False)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=[], nullable=False)

    # Metadata
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
        server_default=func.now(),
        onupdate=datetime.utcnow
    )
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    test_steps: Mapped[List["TestStep"]] = relationship(
        "TestStep",
        back_populates="test_definition",
        cascade="all, delete-orphan",
        order_by="TestStep.step_number"
    )
    test_versions: Mapped[List["TestVersion"]] = relationship(
        "TestVersion",
        back_populates="test_definition",
        cascade="all, delete-orphan",
        order_by="TestVersion.version.desc()"
    )

    def __repr__(self) -> str:
        return f"<TestDefinition(id={self.id}, test_id='{self.test_id}', name='{self.name}')>"
