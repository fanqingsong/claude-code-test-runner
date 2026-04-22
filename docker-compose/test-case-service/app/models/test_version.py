"""
Test Version ORM Model

Represents historical snapshots of test definitions for versioning.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.test_definition import TestDefinition


class TestVersion(Base):
    """
    Test Version Model

    Stores snapshots of test definitions for version history and rollback.
    The snapshot field contains the complete test definition as JSON.
    """

    __tablename__ = "test_versions"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key
    test_definition_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("test_definitions.id", ondelete="CASCADE"),
        nullable=False
    )

    # Version fields
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    change_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        func.now(),
        nullable=False,
        default=datetime.utcnow
    )
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)

    # Relationships
    test_definition: Mapped["TestDefinition"] = relationship(
        "TestDefinition",
        back_populates="test_versions"
    )

    def __repr__(self) -> str:
        return f"<TestVersion(id={self.id}, version={self.version}, test_definition_id={self.test_definition_id})>"
