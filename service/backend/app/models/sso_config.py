"""
SSO Configuration Model

Stores SSO provider configurations (Casdoor, etc.).
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.core.database import Base


class SSOConfig(Base):
    """SSO configuration model."""

    __tablename__ = "sso_configs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), nullable=False)  # casdoor, auth0, etc.
    endpoint = Column(String(500), nullable=False)
    client_id = Column(String(255), nullable=False)
    client_secret = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SSOConfig(id={self.id}, provider='{self.provider}', enabled={self.is_enabled})>"
