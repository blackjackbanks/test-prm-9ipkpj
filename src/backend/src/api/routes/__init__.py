"""
FastAPI routes initialization module that aggregates and exports all API route handlers
for the COREos platform with comprehensive error handling, metrics collection, and security controls.

Version: 1.0.0
"""

from fastapi import APIRouter
from fastapi.exceptions import HTTPException, RequestValidationError
from prometheus_fastapi_instrumentator import PrometheusMiddleware
from fastapi_limiter import RateLimitMiddleware
from fastapi_audit import AuditLogMiddleware

# Import route modules
from api.routes.auth import router as auth_router
from api.routes.context import router as context_router
from api.routes.organizations import router as organizations_router
from api.routes.health import router as health_router
from api.routes.integrations import router as integrations_router
from api.routes.templates import router as templates_router
from api.routes.users import router as users_router

# Initialize root router with API prefix and default error responses
root_router = APIRouter(
    prefix="/api/v1",
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

# Add metrics middleware for request tracking
root_router.add_middleware(
    PrometheusMiddleware,
    app_name="coreos_api",
    prefix="coreos",
    metrics_route="/metrics",
    filter_unhandled_paths=True,
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    enable_defaults=True
)

# Add rate limiting middleware
root_router.add_middleware(
    RateLimitMiddleware,
    rate_limit_key="client_ip",
    rate_limit=1000,  # Default requests per minute
    burst_limit=5000  # Maximum burst requests
)

# Add audit logging middleware
root_router.add_middleware(
    AuditLogMiddleware,
    app_name="coreos",
    exclude_paths=["/health", "/metrics"],
    audit_log_handler="json"
)

# Include all route modules in order of priority
root_router.include_router(
    health_router,
    prefix="/health",
    tags=["Health"]
)

root_router.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"]
)

root_router.include_router(
    users_router,
    prefix="/users",
    tags=["Users"]
)

root_router.include_router(
    organizations_router,
    prefix="/organizations",
    tags=["Organizations"]
)

root_router.include_router(
    context_router,
    prefix="/context",
    tags=["Context"]
)

root_router.include_router(
    integrations_router,
    prefix="/integrations",
    tags=["Integrations"]
)

root_router.include_router(
    templates_router,
    prefix="/templates",
    tags=["Templates"]
)

# Configure security headers
security_headers = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
    "Referrer-Policy": "strict-origin-when-cross-origin"
}

# Add security headers to all responses
@root_router.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    for header, value in security_headers.items():
        response.headers[header] = value
    return response

# Configure CORS settings
cors_settings = {
    "allow_origins": ["*"],  # Replace with actual allowed origins in production
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["*"],
    "expose_headers": ["X-Request-ID"]
}

# Export the configured root router
__all__ = ["root_router"]