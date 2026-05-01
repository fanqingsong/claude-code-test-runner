"""
Unified Authentication Service for Scheduler Service

Supports both local JWT authentication and Casdoor SSO authentication.
"""

import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Casdoor SDK (optional import)
try:
    from casdoor import CasdoorSDK
    CASDOOR_AVAILABLE = True
except ImportError:
    CASDOOR_AVAILABLE = False

# HTTP Bearer token scheme
security = HTTPBearer()

# Global Casdoor SDK instance
_casdoor_sdk = None


def get_casdoor_sdk():
    """Get or initialize Casdoor SDK."""
    global _casdoor_sdk
    if not CASDOOR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Casdoor SDK not installed. Install with: pip install casdoor"
        )

    if _casdoor_sdk is None:
        endpoint = os.environ.get("CASDOOR_ENDPOINT", "http://casdoor:8000")
        client_id = os.environ.get("CASDOOR_CLIENT_ID", "")
        client_secret = os.environ.get("CASDOOR_CLIENT_SECRET", "")
        organization = os.environ.get("CASDOOR_ORGANIZATION", "admin")
        application = os.environ.get("CASDOOR_APPLICATION", "app-example")
        certificate = os.environ.get("CASDOOR_CERTIFICATE", "")

        if not client_id or not client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Casdoor configuration missing"
            )

        _casdoor_sdk = CasdoorSDK(
            endpoint=endpoint,
            client_id=client_id,
            client_secret=client_secret,
            certificate=certificate,
            org_name=organization,
            application_name=application
        )

    return _casdoor_sdk


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Verify a JWT token from Authorization header.

    For scheduler service, we only verify tokens and extract user info.
    The actual token validation is done by test-case-service.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        dict: User information from token
    """
    token = credentials.credentials

    # Try Casdoor token first
    try:
        if CASDOOR_AVAILABLE:
            sdk = get_casdoor_sdk()
            payload = sdk.parse_jwt_token(token)
            return {
                "sub": payload.get("id"),
                "username": payload.get("name"),
                "email": payload.get("email"),
                "provider": "casdoor",
                "roles": payload.get("roles", [])
            }
    except Exception:
        pass

    # If Casdoor failed, raise error
    # (Scheduler service only accepts Casdoor tokens for now)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def verify_permission(required_roles: list = None):
    """
    Dependency factory to verify if user has required roles.

    Args:
        required_roles: List of roles required to access the resource

    Returns:
        FastAPI dependency function
    """
    async def dependency(user: dict = Depends(verify_token)):
        """Inner dependency that checks user roles."""
        if required_roles is None:
            return user

        # Check if user has required roles
        user_roles = user.get("roles", [])

        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

        return user

    return dependency
