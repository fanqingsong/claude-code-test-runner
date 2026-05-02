"""
Unified Authentication Service for Scheduler Service

Supports both local JWT authentication and Casdoor SSO authentication.
"""

import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

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

# JWT settings (same as test-case-service)
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"


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


def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT access token.

    Args:
        token: The JWT token to decode

    Returns:
        dict: The decoded token payload

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Verify a JWT token from Authorization header.

    Supports both local JWT tokens and Casdoor tokens.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        dict: User information from token
    """
    token = credentials.credentials

    # Try local JWT first
    try:
        payload = decode_access_token(token)
        # Add provider information
        payload["provider"] = "local"
        user_id = payload.get("sub")
        if user_id:
            return payload
    except HTTPException:
        pass  # Try Casdoor next
    except Exception:
        pass  # Try Casdoor next

    # Try Casdoor token
    try:
        if CASDOOR_AVAILABLE:
            sdk = get_casdoor_sdk()
            payload = sdk.parse_jwt_token(token)
            # Normalize Casdoor payload to match local format
            normalized_payload = {
                "sub": payload.get("id"),
                "username": payload.get("name"),
                "email": payload.get("email"),
                "provider": "casdoor",
                "roles": payload.get("roles", [])
            }
            return normalized_payload
    except Exception:
        pass

    # If neither worked, raise error
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
