"""
FastAPI dependency injection module providing reusable dependencies for authentication,
authorization, database access and other common requirements across API endpoints.

Version: 1.0.0
"""

from typing import Dict, Optional, Any
from fastapi import Depends, Security, Request, HTTPException
from fastapi.security import OAuth2PasswordBearer
import redis
import logging
from functools import wraps
from datetime import datetime

from security.authentication import AuthenticationManager
from security.authorization import RBACHandler
from data.repositories.user import UserRepository
from utils.exceptions import AuthenticationException
from utils.constants import ErrorCodes
from config.settings import get_settings

# Configure logging
logger = logging.getLogger(__name__)

# Initialize settings
settings = get_settings()

# Initialize OAuth2 scheme with enhanced security
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl='api/v1/auth/token',
    auto_error=True,
    scheme_name='JWT'
)

# Initialize Redis client for caching
redis_client = redis.Redis(
    host=settings.CACHE_SETTINGS['url'],
    port=settings.CACHE_SETTINGS['port'],
    db=0,
    decode_responses=True,
    socket_timeout=settings.CACHE_SETTINGS['socket_timeout'],
    socket_connect_timeout=settings.CACHE_SETTINGS['socket_connect_timeout'],
    health_check_interval=settings.CACHE_SETTINGS['health_check_interval']
)

# Initialize core services
auth_manager = AuthenticationManager({
    'redis_client': redis_client,
    'rate_limit': settings.RATE_LIMITS['default']
})
rbac_handler = RBACHandler()

def cache(ttl: int = 300):
    """
    Cache decorator for dependency functions.
    
    Args:
        ttl: Cache time-to-live in seconds
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Check cache
            cached_result = await redis_client.get(cache_key)
            if cached_result:
                return cached_result
                
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await redis_client.setex(cache_key, ttl, result)
            return result
            
        return wrapper
    return decorator

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    request: Request = None
) -> Dict[str, Any]:
    """
    Enhanced dependency function to get current authenticated user from token.
    Implements caching, audit logging, and security monitoring.
    
    Args:
        token: JWT token from request
        request: FastAPI request object
        
    Returns:
        Dict containing validated user data
        
    Raises:
        HTTPException: If authentication fails
    """
    try:
        # Check token cache
        cache_key = f"token:{token}"
        cached_user = await redis_client.get(cache_key)
        if cached_user:
            return cached_user
            
        # Validate token
        user_data = await auth_manager.validate_token(token)
        
        # Log authentication
        logger.info(
            "User authenticated",
            extra={
                'user_id': user_data.get('sub'),
                'ip': request.client.host if request else None,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        
        # Cache validated token
        await redis_client.setex(cache_key, 300, user_data)
        
        return user_data
        
    except AuthenticationException as e:
        logger.warning(
            f"Authentication failed: {str(e)}",
            extra={'error_code': e.error_code}
        )
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )

async def verify_permission(
    permission: str,
    current_user: Dict = Depends(get_current_user),
    request: Request = None
) -> bool:
    """
    Enhanced dependency function to verify user has required permission.
    Implements caching and comprehensive audit logging.
    
    Args:
        permission: Required permission
        current_user: Current authenticated user data
        request: FastAPI request object
        
    Returns:
        bool indicating if permission is granted
        
    Raises:
        HTTPException: If permission check fails
    """
    try:
        # Check permission cache
        cache_key = f"perm:{current_user['sub']}:{permission}"
        cached_result = await redis_client.get(cache_key)
        if cached_result is not None:
            return bool(cached_result)
            
        # Verify permission
        has_permission = await rbac_handler.verify_permission(
            current_user.get('token'),
            permission
        )
        
        # Log permission check
        logger.info(
            f"Permission check: {permission}",
            extra={
                'user_id': current_user.get('sub'),
                'permission': permission,
                'granted': has_permission,
                'ip': request.client.host if request else None
            }
        )
        
        # Cache result
        await redis_client.setex(cache_key, 300, int(has_permission))
        
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )
            
        return has_permission
        
    except Exception as e:
        logger.error(f"Permission verification failed: {str(e)}")
        raise HTTPException(
            status_code=403,
            detail="Permission verification failed"
        )

async def get_user_repository() -> UserRepository:
    """
    Enhanced dependency function to get UserRepository instance.
    Implements connection pooling and monitoring.
    
    Returns:
        Configured UserRepository instance
    """
    try:
        # Create repository with connection pool
        repository = UserRepository()
        
        # Configure monitoring
        repository.set_monitoring_hooks({
            'on_query': lambda q: logger.debug(f"Executing query: {q}"),
            'on_error': lambda e: logger.error(f"Repository error: {e}")
        })
        
        return repository
        
    except Exception as e:
        logger.error(f"Failed to create repository: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

class PermissionDependency:
    """
    Enhanced class-based dependency for complex permission checking.
    Implements caching, audit logging and context-based verification.
    """
    
    def __init__(self, required_permission: str, context: Optional[Dict] = None):
        """
        Initialize permission dependency with context.
        
        Args:
            required_permission: Permission to check
            context: Optional context data for verification
        """
        self.required_permission = required_permission
        self.context = context or {}
        self._rbac_handler = RBACHandler()
        
    async def __call__(
        self,
        current_user: Dict = Depends(get_current_user),
        request: Request = None
    ) -> bool:
        """
        Enhanced callable implementation for dependency injection.
        
        Args:
            current_user: Current authenticated user
            request: FastAPI request object
            
        Returns:
            bool indicating if permission is granted
        """
        try:
            # Check permission with context
            has_permission = await self._rbac_handler.verify_permission(
                current_user.get('token'),
                self.required_permission,
                context=self.context
            )
            
            # Log verification
            logger.info(
                f"Context-based permission check: {self.required_permission}",
                extra={
                    'user_id': current_user.get('sub'),
                    'permission': self.required_permission,
                    'context': self.context,
                    'granted': has_permission
                }
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=403,
                    detail="Insufficient permissions for context"
                )
                
            return has_permission
            
        except Exception as e:
            logger.error(f"Context permission check failed: {str(e)}")
            raise HTTPException(
                status_code=403,
                detail="Permission verification failed"
            )