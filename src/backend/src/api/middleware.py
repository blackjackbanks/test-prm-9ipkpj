"""
Enhanced FastAPI middleware implementations for request/response processing.
Provides secure authentication, distributed rate limiting, and comprehensive audit logging.

Version: 1.0.0
"""

from datetime import datetime, timedelta  # version: 3.11+
from typing import Dict, List, Optional, Callable
import logging  # version: 3.11+
import uuid
import json

from fastapi import FastAPI  # version: 0.100+
from starlette.requests import Request  # version: 0.27+
from starlette.responses import Response  # version: 0.27+
from starlette.middleware.base import BaseHTTPMiddleware  # version: 0.27+
from fastapi import HTTPException  # version: 0.100+

from security.jwt import JWTHandler, decode_token, validate_token, rotate_key
from utils.exceptions import AuthenticationException
from utils.cache import get_cache, set_cache, increment_cache
from utils.constants import ErrorCodes, HTTPStatusCodes

# Configure logging
logger = logging.getLogger("api.middleware")

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Enhanced JWT authentication middleware with key rotation and security audit logging.
    Implements secure token validation and user context management.
    """
    
    def __init__(self, app: FastAPI, public_paths: List[str], jwt_config: Dict) -> None:
        """
        Initialize authentication middleware with enhanced security features.
        
        Args:
            app: FastAPI application instance
            public_paths: List of paths that bypass authentication
            jwt_config: JWT configuration parameters
        """
        super().__init__(app)
        self._jwt_handler = JWTHandler()
        self._logger = logging.getLogger("auth.middleware")
        self._public_paths = public_paths
        
        # Configure security settings
        self._token_blacklist_key = "token_blacklist"
        self._key_rotation_interval = timedelta(hours=24)
        self._last_rotation = datetime.utcnow()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request for authentication with enhanced security features.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response with security headers
            
        Raises:
            AuthenticationException: If authentication fails
        """
        # Generate request correlation ID
        request.state.correlation_id = str(uuid.uuid4())
        
        # Check if path requires authentication
        if self._is_public_path(request.url.path):
            return await call_next(request)
            
        try:
            # Extract and validate token
            token = self._extract_token(request)
            if not token:
                raise AuthenticationException(
                    message="No authentication token provided",
                    error_code=ErrorCodes.AUTH_FAILED.value
                )
                
            # Verify token and claims
            payload = await self._verify_token(token)
            
            # Check token revocation
            if await self._is_token_revoked(token):
                raise AuthenticationException(
                    message="Token has been revoked",
                    error_code=ErrorCodes.INVALID_TOKEN.value
                )
                
            # Attach user context
            request.state.user = payload
            
            # Log security event
            self._logger.info(
                "Authentication successful",
                extra={
                    "user_id": payload.get("sub"),
                    "correlation_id": request.state.correlation_id
                }
            )
            
            # Process request
            response = await call_next(request)
            
            # Add security headers
            response.headers.update(self._get_security_headers())
            
            return response
            
        except AuthenticationException as e:
            self._logger.warning(
                f"Authentication failed: {str(e)}",
                extra={"correlation_id": request.state.correlation_id}
            )
            raise
        except Exception as e:
            self._logger.error(
                f"Authentication error: {str(e)}",
                extra={"correlation_id": request.state.correlation_id}
            )
            raise HTTPException(
                status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
                detail="Internal server error"
            )

    def _is_public_path(self, path: str) -> bool:
        """Check if path bypasses authentication."""
        return any(path.startswith(public_path) for public_path in self._public_paths)

    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from Authorization header."""
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header.split(" ")[1]
        return None

    async def _verify_token(self, token: str) -> Dict:
        """Verify JWT token with enhanced security checks."""
        # Check for key rotation
        await self._check_key_rotation()
        return await validate_token(token)

    async def _is_token_revoked(self, token: str) -> bool:
        """Check if token has been revoked."""
        return await get_cache(f"{self._token_blacklist_key}:{token}")

    async def _check_key_rotation(self) -> None:
        """Perform periodic key rotation."""
        if datetime.utcnow() - self._last_rotation >= self._key_rotation_interval:
            await rotate_key()
            self._last_rotation = datetime.utcnow()

    def _get_security_headers(self) -> Dict[str, str]:
        """Get secure response headers."""
        return {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
        }

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Distributed rate limiting middleware with burst allowance support.
    Implements token bucket algorithm with Redis-based tracking.
    """
    
    def __init__(self, app: FastAPI, rate_limits: Dict) -> None:
        """
        Initialize rate limit middleware with configurable limits.
        
        Args:
            app: FastAPI application instance
            rate_limits: Rate limit configuration
        """
        super().__init__(app)
        self._rate_limits = rate_limits
        self._logger = logging.getLogger("ratelimit.middleware")
        
        # Configure rate limit settings
        self._window_seconds = 60
        self._burst_multiplier = 1.5

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request for rate limiting with burst allowance.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response with rate limit headers
            
        Raises:
            HTTPException: If rate limit exceeded
        """
        try:
            # Extract identifiers
            user_id = request.state.user.get("sub") if hasattr(request.state, "user") else "anonymous"
            org_id = request.state.user.get("org_id") if hasattr(request.state, "user") else "anonymous"
            
            # Calculate time window
            current_window = int(datetime.utcnow().timestamp() / self._window_seconds)
            
            # Check user rate limit
            user_key = f"rate_limit:user:{user_id}:{current_window}"
            user_count = await self._increment_counter(user_key)
            
            # Check organization rate limit
            org_key = f"rate_limit:org:{org_id}:{current_window}"
            org_count = await self._increment_counter(org_key)
            
            # Apply rate limits with burst allowance
            user_limit = self._rate_limits["user"]
            org_limit = self._rate_limits["org"]
            
            if user_count > user_limit * self._burst_multiplier:
                raise HTTPException(
                    status_code=HTTPStatusCodes.TOO_MANY_REQUESTS.value,
                    detail="User rate limit exceeded"
                )
                
            if org_count > org_limit * self._burst_multiplier:
                raise HTTPException(
                    status_code=HTTPStatusCodes.TOO_MANY_REQUESTS.value,
                    detail="Organization rate limit exceeded"
                )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers.update(self._get_rate_limit_headers(user_count, org_count))
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            self._logger.error(f"Rate limit error: {str(e)}")
            raise HTTPException(
                status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
                detail="Internal server error"
            )

    async def _increment_counter(self, key: str) -> int:
        """Increment rate limit counter with TTL."""
        count = await increment_cache(key)
        if count == 1:
            await set_cache(key, count, self._window_seconds)
        return count

    def _get_rate_limit_headers(self, user_count: int, org_count: int) -> Dict[str, str]:
        """Get rate limit response headers."""
        return {
            "X-RateLimit-Limit": str(self._rate_limits["user"]),
            "X-RateLimit-Remaining": str(max(0, self._rate_limits["user"] - user_count)),
            "X-RateLimit-Reset": str(int(datetime.utcnow().timestamp() / self._window_seconds) * self._window_seconds)
        }

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive logging middleware with security audit trail.
    Implements detailed request/response logging and performance tracking.
    """
    
    def __init__(self, app: FastAPI, logging_config: Dict) -> None:
        """
        Initialize logging middleware with audit capabilities.
        
        Args:
            app: FastAPI application instance
            logging_config: Logging configuration
        """
        super().__init__(app)
        self._logger = logging.getLogger("audit.middleware")
        self._config = logging_config

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request for comprehensive logging.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response after logging
        """
        start_time = datetime.utcnow()
        
        # Generate correlation ID if not exists
        if not hasattr(request.state, "correlation_id"):
            request.state.correlation_id = str(uuid.uuid4())
            
        # Log request
        await self._log_request(request)
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate response time
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Log response
            await self._log_response(request, response, duration)
            
            return response
            
        except Exception as e:
            # Log error
            self._logger.error(
                f"Request failed: {str(e)}",
                extra={
                    "correlation_id": request.state.correlation_id,
                    "duration": (datetime.utcnow() - start_time).total_seconds()
                }
            )
            raise

    async def _log_request(self, request: Request) -> None:
        """Log incoming request details."""
        self._logger.info(
            "Incoming request",
            extra={
                "correlation_id": request.state.correlation_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host,
                "user_agent": request.headers.get("User-Agent"),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    async def _log_response(self, request: Request, response: Response, duration: float) -> None:
        """Log response details with performance metrics."""
        self._logger.info(
            "Request completed",
            extra={
                "correlation_id": request.state.correlation_id,
                "status_code": response.status_code,
                "duration": duration,
                "response_size": len(response.body) if hasattr(response, "body") else 0,
                "timestamp": datetime.utcnow().isoformat()
            }
        )