from fastapi import APIRouter

from app.api.v1.endpoints import auth, mfa, password, sessions, admin

# Create API v1 router
api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(mfa.router, prefix="/auth/mfa", tags=["MFA"])
api_router.include_router(password.router, prefix="/auth/password", tags=["Password"])
api_router.include_router(sessions.router, prefix="/auth/sessions", tags=["Sessions"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
