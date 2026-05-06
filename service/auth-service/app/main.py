from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
import logging

logger = logging.getLogger(__name__)

# Setup structured logging
setup_logging()


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""

    async def dispatch(self, request, call_next):
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy (basic - adjust for production)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )

        # HSTS (HTTP Strict Transport Security) - only in production with HTTPS
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response

# Create FastAPI application
app = FastAPI(
    title="Authentication Service",
    description="User authentication, MFA, and session management API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add HTTPS redirect in production
if settings.ENVIRONMENT == "production":
    app.add_middleware(HTTPSRedirectMiddleware)


@app.on_event("startup")
async def startup_event():
    """Application startup: initialize database connections and services"""
    logger.info("Starting Authentication Service")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown: cleanup resources"""
    logger.info("Shutting down Authentication Service")


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for container orchestration"""
    return {"status": "healthy", "service": "auth-service"}


# Include API routers
from app.api.v1.router import api_router
app.include_router(api_router, prefix="/api/v1")
