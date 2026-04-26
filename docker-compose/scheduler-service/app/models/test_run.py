"""
Test Run ORM Model

Records the execution history of scheduled tests.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TestRun(Base):
    """
    Test Run Model

    Records the execution details and results of a scheduled test run.
    """

    __tablename__ = "test_runs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign keys
    schedule_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    test_definition_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Run identification
    run_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Execution timing
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_duration_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Result statistics
    total_tests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Detailed results
    test_cases: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Retry information
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_retry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<TestRun(id={self.id}, run_id='{self.run_id}', status='{self.status}')>"
