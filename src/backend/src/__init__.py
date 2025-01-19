"""
Root initialization module for the COREos backend application.
Configures and exports core application components with comprehensive security,
monitoring, and health checks.

Version: 1.0.0
"""

import logging
from typing import Optional
from fastapi import FastAPI
from prometheus_client import Counter, Histogram
from starlette.middleware import Middleware

from api import root_router, websocket_manager, error_handlers
from config import init_app, settings, logger, security_config, init_database, get_db, monitoring
from api.middleware import (
    AuthenticationMiddleware,
    RateLimitMiddleware,
    LoggingMiddleware
)

# Global version
VERSION = '1.0.0'

# Global application instance
app_instance: Optional[FastAPI] = None

# Global startup flag
startup_complete = False

# Initialize Prometheus metrics
app_startup_time = Histogram(
    'app_startup_seconds',
    'Application startup duration'
)
app_requests = Counter(
    'app_requests_total',
    'Total application requests',
    ['method', 'endpoint', 'status']
)

async def initialize_application() -> FastAPI:
    """
    Initialize and configure the complete COREos backend application with proper
    startup order, monitoring, and shutdown handling.

    Returns:
        FastAPI: Configured FastAPI application instance
    """
    global app_instance, startup_complete

    with app_startup_time.time():
        try:
            # Initialize core configuration
            await init_app()

            # Create FastAPI application with enhanced security
            app = FastAPI(
                title="COREos API",
                version=VERSION,
                docs_url="/api/docs",
                redoc_url="/api/redoc",
                openapi_url="/api/openapi.json"
            )

            # Configure middleware with security features
            app.add_middleware(
                AuthenticationMiddleware,
                public_paths=["/api/v1/auth", "/api/health"],
                jwt_config=settings.SECURITY_SETTINGS
            )

            app.add_middleware(
                RateLimitMiddleware,
                rate_limits=settings.RATE_LIMITS
            )

            app.add_middleware(
                LoggingMiddleware,
                logging_config={
                    "log_request_body": False,
                    "log_response_body": False,
                    "sensitive_headers": ["Authorization", "Cookie"]
                }
            )

            # Register error handlers
            app.add_exception_handler(Exception, error_handlers.handle_unhandled_exception)
            app.add_exception_handler(ValueError, error_handlers.handle_validation_error)
            app.add_exception_handler(Exception, error_handlers.handle_http_exception)

            # Configure monitoring and health checks
            await configure_monitoring(app)

            # Include API routes
            app.include_router(root_router)

            # Configure WebSocket support
            app.websocket_route("/ws")(websocket_manager.handle_connection)

            # Register startup event
            @app.on_event("startup")
            async def startup_event():
                global startup_complete
                logger.info("Starting COREos API server")
                await init_database()
                startup_complete = True

            # Register shutdown event
            @app.on_event("shutdown")
            async def shutdown_event():
                global startup_complete
                logger.info("Shutting down COREos API server")
                await cleanup_resources()
                startup_complete = False

            # Store global instance
            app_instance = app
            return app

        except Exception as e:
            logger.error(f"Application initialization failed: {str(e)}")
            raise

async def configure_monitoring(app: FastAPI) -> None:
    """
    Set up monitoring, metrics collection, and health checks.

    Args:
        app: FastAPI application instance
    """
    # Add health check endpoint
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy" if startup_complete else "starting",
            "version": VERSION,
            "database": "connected" if get_db() else "disconnected"
        }

    # Add metrics endpoint
    @app.get("/metrics")
    async def metrics():
        return await monitoring.get_metrics()

    # Configure performance monitoring
    app.add_middleware(monitoring.PerformanceMonitoringMiddleware)

async def cleanup_resources() -> None:
    """Gracefully cleanup resources during shutdown."""
    try:
        # Close database connections
        if get_db():
            await get_db().close()

        # Clear caches
        await security_config.clear_caches()

        # Stop background tasks
        if websocket_manager:
            await websocket_manager.cleanup()

        logger.info("Resources cleaned up successfully")

    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        raise

# Export core components
__all__ = [
    'VERSION',
    'app_instance',
    'initialize_application',
    'configure_monitoring',
    'cleanup_resources'
]