"""
FastAPI application initialization module that configures the core API server with routes,
middleware, error handlers, and WebSocket support for the COREos platform.

Version: 1.0.0
"""

import logging
from contextlib import asynccontextmanager
from typing import Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram  # v0.17.0
from redis import Redis  # v4.6.0
from opentelemetry import trace  # v1.19.0

from api.routes import root_router
from api.middleware import (
    AuthenticationMiddleware,
    RateLimitMiddleware,
    LoggingMiddleware
)
from api.error_handlers import (
    handle_coreos_exception,
    handle_validation_error,
    handle_http_exception,
    handle_unhandled_exception
)
from api.websocket import WebSocketManager
from utils.exceptions import COREosBaseException
from utils.constants import CORS_ORIGINS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Initialize Prometheus metrics
API_REQUESTS = Counter(
    'api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)
API_LATENCY = Histogram(
    'api_request_latency_seconds',
    'API request latency',
    ['method', 'endpoint']
)

# Initialize Redis connection pool
REDIS_POOL = Redis(
    host='localhost',  # Override with settings in production
    port=6379,
    db=0,
    decode_responses=True,
    max_connections=100
)

@asynccontextmanager
async def init_app() -> FastAPI:
    """
    Initialize and configure the FastAPI application with enhanced security features.
    
    Returns:
        FastAPI: Configured application instance
    """
    # Create FastAPI instance with OpenAPI configuration
    app = FastAPI(
        title="COREos API",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json"
    )

    # Configure CORS with security headers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
        max_age=3600
    )

    # Add security middleware
    app.add_middleware(
        AuthenticationMiddleware,
        public_paths=["/api/v1/auth", "/api/health"],
        jwt_config={"algorithm": "HS256"}
    )

    # Add rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        rate_limits={
            "user": 1000,  # Requests per minute per user
            "org": 5000    # Requests per minute per organization
        }
    )

    # Add logging middleware
    app.add_middleware(
        LoggingMiddleware,
        logging_config={
            "log_request_body": False,
            "log_response_body": False,
            "sensitive_headers": ["Authorization", "Cookie"]
        }
    )

    # Register error handlers
    app.add_exception_handler(COREosBaseException, handle_coreos_exception)
    app.add_exception_handler(Exception, handle_unhandled_exception)
    app.add_exception_handler(ValueError, handle_validation_error)
    app.add_exception_handler(Exception, handle_http_exception)

    # Initialize WebSocket manager
    websocket_manager = WebSocketManager(
        redis_manager=REDIS_POOL,
        auth_manager=None,  # Inject actual auth manager
        context_service=None  # Inject actual context service
    )

    # Register WebSocket route
    @app.websocket("/ws")
    async def websocket_endpoint(websocket):
        await websocket_manager.handle_connection(
            websocket=websocket,
            token=websocket.headers.get("Authorization", "").split(" ")[1],
            context={"client_ip": websocket.client.host}
        )

    # Include API routes
    app.include_router(root_router)

    # Startup event handler
    @app.on_event("startup")
    async def startup_event():
        logger.info("Starting COREos API server")
        # Initialize connections and verify dependencies
        try:
            await REDIS_POOL.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            raise

    # Shutdown event handler
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Shutting down COREos API server")
        # Cleanup connections and resources
        try:
            await REDIS_POOL.close()
            logger.info("Redis connection closed")
        except Exception as e:
            logger.error(f"Error during shutdown: {str(e)}")

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": "1.0.0"}

    yield app

async def shutdown_app():
    """Gracefully shutdown the application and cleanup resources."""
    try:
        # Close Redis connections
        await REDIS_POOL.close()
        logger.info("Application shutdown completed")
    except Exception as e:
        logger.error(f"Error during application shutdown: {str(e)}")
        raise

# Initialize application instance
app = FastAPI()

# Export application components
__all__ = ["app", "init_app", "shutdown_app"]