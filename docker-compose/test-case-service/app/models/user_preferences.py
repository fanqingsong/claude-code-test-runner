"""
User Preferences ORM Model

Stores user-specific preferences for dashboard and UI customization.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserPreferences(Base):
    """
    User Preferences Model

    Stores user-specific preferences and settings.
    """
    __tablename__ = "user_preferences"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to users
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )

    # Dashboard preferences
    dashboard_layout: Mapped[str] = mapped_column(
        String(50),
        default="default",
        nullable=False
    )

    # Notification preferences
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    # UI preferences
    language: Mapped[str] = mapped_column(
        String(10),
        default="en",
        nullable=False
    )

    theme: Mapped[str] = mapped_column(
        String(20),
        default="light",
        nullable=False
    )

    # Timestamps
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

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        backref="preferences",
        uselist=False
    )

    def __repr__(self) -> str:
        return f"<UserPreferences(id={self.id}, user_id={self.user_id})>"
