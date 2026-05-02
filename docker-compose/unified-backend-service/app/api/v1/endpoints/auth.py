"""
Authentication API Endpoints

User registration, login, and token management.
Supports both local and Casdoor authentication.
"""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models import User
from app.schemas import Token, UserCreate, UserLogin, UserResponse
from app.services.unified_auth import (
    authenticate_user_casdoor,
    refresh_token as refresh_auth_token,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user.

    - **username**: Unique username (min 3 characters)
    - **email**: Valid email address
    - **password**: Password (min 8 characters)
    """
    # Check if username already exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered"
        )

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    return db_user


@router.post("/login", response_model=Token)
async def login(
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Login and receive access token.

    - **username**: Username
    - **password**: Password
    """
    # Find user by username
    result = await db.execute(select(User).where(User.username == user_data.username))
    user = result.scalar_one_or_none()

    # Verify user exists and password is correct
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email}
    )

    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current authenticated user information.

    Requires valid JWT token.
    """
    # In a real implementation, you would fetch the full user from database
    # For now, return the basic info from token
    return UserResponse(
        id=int(current_user["user_id"]),
        username=current_user["username"],
        email=current_user["email"],
        is_active=True,
        is_admin=False
    )


@router.post("/logout")
async def logout():
    """
    Logout current user.

    Note: In a stateless JWT implementation, logout is handled client-side
    by discarding the token. This endpoint exists for API completeness.
    """
    return {"message": "Successfully logged out"}


@router.post("/login/casdoor")
async def login_casdoor(user_data: UserLogin):
    """
    Login with Casdoor using username and password.

    - **username**: Casdoor username
    - **password**: Casdoor password
    """
    token_response = await authenticate_user_casdoor(user_data.username, user_data.password)

    if not token_response:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Casdoor authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_response


@router.get("/oidc/login")
async def oidc_login():
    """
    Get OIDC authorization URL for Casdoor SSO login.

    Returns the authorization URL and state parameter for CSRF protection.
    """
    import os
    from urllib.parse import urlencode

    state = secrets.token_urlsafe(32)
    casdoor_endpoint = os.environ.get("CASDOOR_ENDPOINT", "http://casdoor:8000")
    casdoor_organization = os.environ.get("CASDOOR_ORGANIZATION", "org")
    casdoor_client_id = os.environ.get("CASDOOR_CLIENT_ID", "")

    auth_url = f"{casdoor_endpoint}/login/oauth/authorize"
    params = {
        "client_id": casdoor_client_id,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": "http://localhost:8080/oidc/callback",
        "state": state,
        "organization": casdoor_organization
    }

    auth_url_with_params = f"{auth_url}?{urlencode(params)}"

    return {
        "auth_url": auth_url_with_params,
        "state": state
    }


@router.get("/oidc/callback")
async def oidc_callback(
    code: str = Query(..., description="Authorization code from Casdoor"),
    state: str = Query(None, description="State parameter for CSRF validation")
):
    """
    Handle OIDC callback from Casdoor.

    - **code**: Authorization code from Casdoor
    - **state**: State parameter for CSRF validation (optional)
    """
    try:
        from app.services.unified_auth import get_casdoor_sdk

        sdk = get_casdoor_sdk()
        token_data = sdk.get_oauth_token(code)

        # Get user info from Casdoor
        user_info = sdk.get_user(token_data["access_token"])

        return {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "token_type": "bearer",
            "provider": "casdoor",
            "expires_in": token_data.get("expires_in", 300),
            "refresh_expires_in": token_data.get("refresh_expires_in", 1800),
            "user": {
                "id": user_info.get("id"),
                "username": user_info.get("name"),
                "email": user_info.get("email"),
                "roles": user_info.get("roles", [])
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OIDC authentication failed: {str(e)}"
        )


@router.post("/refresh")
async def refresh(
    refresh_token: str,
    provider: str = Query(..., description="Auth provider: 'local' or 'casdoor'")
):
    """
    Refresh an access token using a refresh token.

    - **refresh_token**: Refresh token
    - **provider**: Auth provider ('local' or 'casdoor')
    """
    if provider != "casdoor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token refresh only supported for Casdoor provider"
        )

    new_tokens = await refresh_auth_token(refresh_token, provider)

    if not new_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    return new_tokens
