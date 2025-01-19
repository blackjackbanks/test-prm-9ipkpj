"""
Enhanced user management API routes implementing secure authentication, user lifecycle
management, and organization membership with comprehensive security features.

Version: 1.0.0
"""

from typing import Dict, Optional
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_cache import CacheControl
from fastapi_security_headers import SecurityHeaders
from fastapi_limiter import RateLimiter
from python_audit_logger import AuditLogger

from services.user_service import UserService
from utils.constants import ErrorCodes
from utils.exceptions import AuthenticationException, ValidationException

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router with versioning and tags
router = APIRouter(prefix="/api/v1/users", tags=["users"])

# Initialize security components
rate_limiter = RateLimiter(max_requests=100, window_seconds=60)
audit_logger = AuditLogger()
security_headers = SecurityHeaders()

# Cache configuration
cache_control = CacheControl(
    max_age=300,  # 5 minutes
    private=True,
    no_store=True
)

@router.post("/register", status_code=status.HTTP_201_CREATED)
@rate_limiter.check_rate_limit
@security_headers
async def register_user(
    user_data: Dict,
    response: Response,
    user_service: UserService = Depends()
) -> Dict:
    """
    Register new user with enhanced security validation and audit logging.
    
    Args:
        user_data: User registration data
        response: FastAPI response object
        user_service: User service dependency
        
    Returns:
        Dict: Created user data with security headers
        
    Raises:
        ValidationException: If registration data is invalid
        AuthenticationException: If security checks fail
    """
    try:
        # Create user with security validation
        created_user = await user_service.create_user(user_data)
        
        # Log security audit event
        await audit_logger.log_security_event(
            event_type="user_registered",
            user_id=str(created_user["id"]),
            organization_id=str(user_data["organization_id"]),
            details={"email_hash": created_user["email_hash"]}
        )
        
        # Set security headers
        response.headers.update({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block"
        })
        
        return created_user
        
    except Exception as e:
        logger.error(f"User registration failed: {str(e)}")
        raise ValidationException(
            message="Registration failed",
            error_code=ErrorCodes.AUTH_FAILED.value,
            details={"error": str(e)}
        )

@router.post("/login")
@rate_limiter.check_rate_limit
@security_headers
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    user_service: UserService = Depends()
) -> Dict:
    """
    Authenticate user with enhanced security checks and MFA support.
    
    Args:
        form_data: OAuth2 password form data
        user_service: User service dependency
        
    Returns:
        Dict: Authentication tokens and MFA status
        
    Raises:
        AuthenticationException: If authentication fails
    """
    try:
        # Authenticate user
        auth_result = await user_service.authenticate(
            email=form_data.username,
            password=form_data.password,
            mfa_code=form_data.scopes[0] if form_data.scopes else None
        )
        
        # Log authentication event
        await audit_logger.log_security_event(
            event_type="user_login",
            user_id=auth_result.get("user_id"),
            details={"mfa_used": bool(form_data.scopes)}
        )
        
        return auth_result
        
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise AuthenticationException(
            message="Authentication failed",
            error_code=ErrorCodes.AUTH_FAILED.value
        )

@router.post("/oauth/{provider}")
@rate_limiter.check_rate_limit
@security_headers
async def oauth_login(
    provider: str,
    auth_data: Dict,
    user_service: UserService = Depends()
) -> Dict:
    """
    Authenticate user via OAuth2 provider with enhanced security.
    
    Args:
        provider: OAuth2 provider name
        auth_data: OAuth2 authentication data
        user_service: User service dependency
        
    Returns:
        Dict: Authentication tokens
        
    Raises:
        AuthenticationException: If OAuth authentication fails
    """
    try:
        # Authenticate with OAuth provider
        auth_result = await user_service.authenticate_oauth(
            provider=provider,
            code=auth_data["code"],
            auth_options=auth_data.get("options", {})
        )
        
        # Log OAuth authentication
        await audit_logger.log_security_event(
            event_type="oauth_login",
            user_id=auth_result.get("user_id"),
            details={"provider": provider}
        )
        
        return auth_result
        
    except Exception as e:
        logger.error(f"OAuth authentication failed: {str(e)}")
        raise AuthenticationException(
            message="OAuth authentication failed",
            error_code=ErrorCodes.AUTH_FAILED.value
        )

@router.post("/mfa/configure")
@rate_limiter.check_rate_limit
@security_headers
async def configure_mfa(
    mfa_config: Dict,
    user_id: UUID,
    user_service: UserService = Depends()
) -> Dict:
    """
    Configure multi-factor authentication for user.
    
    Args:
        mfa_config: MFA configuration data
        user_id: User identifier
        user_service: User service dependency
        
    Returns:
        Dict: MFA configuration status
        
    Raises:
        ValidationException: If MFA configuration fails
    """
    try:
        # Configure MFA
        mfa_result = await user_service.configure_mfa(
            user_id=user_id,
            mfa_config=mfa_config
        )
        
        # Log MFA configuration
        await audit_logger.log_security_event(
            event_type="mfa_configured",
            user_id=str(user_id),
            details={"mfa_type": mfa_config.get("type")}
        )
        
        return mfa_result
        
    except Exception as e:
        logger.error(f"MFA configuration failed: {str(e)}")
        raise ValidationException(
            message="MFA configuration failed",
            error_code=ErrorCodes.AUTH_FAILED.value
        )

@router.post("/mfa/verify")
@rate_limiter.check_rate_limit
async def verify_mfa(
    verification_data: Dict,
    user_service: UserService = Depends()
) -> Dict:
    """
    Verify MFA code for authentication.
    
    Args:
        verification_data: MFA verification data
        user_service: User service dependency
        
    Returns:
        Dict: Verification status and tokens
        
    Raises:
        AuthenticationException: If MFA verification fails
    """
    try:
        # Verify MFA code
        verification_result = await user_service.verify_mfa(
            user_id=verification_data["user_id"],
            mfa_code=verification_data["code"]
        )
        
        # Log MFA verification
        await audit_logger.log_security_event(
            event_type="mfa_verified",
            user_id=str(verification_data["user_id"])
        )
        
        return verification_result
        
    except Exception as e:
        logger.error(f"MFA verification failed: {str(e)}")
        raise AuthenticationException(
            message="MFA verification failed",
            error_code=ErrorCodes.AUTH_FAILED.value
        )

@router.get("/me")
@rate_limiter.check_rate_limit
@cache_control
async def get_current_user(
    user_id: UUID,
    user_service: UserService = Depends()
) -> Dict:
    """
    Get current authenticated user data.
    
    Args:
        user_id: User identifier
        user_service: User service dependency
        
    Returns:
        Dict: User data
        
    Raises:
        ValidationException: If user retrieval fails
    """
    try:
        return await user_service.get_user_by_id(user_id)
        
    except Exception as e:
        logger.error(f"User retrieval failed: {str(e)}")
        raise ValidationException(
            message="Failed to retrieve user data",
            error_code=ErrorCodes.AUTH_FAILED.value
        )

@router.put("/me")
@rate_limiter.check_rate_limit
async def update_current_user(
    user_id: UUID,
    update_data: Dict,
    user_service: UserService = Depends()
) -> Dict:
    """
    Update current user data with security validation.
    
    Args:
        user_id: User identifier
        update_data: Data to update
        user_service: User service dependency
        
    Returns:
        Dict: Updated user data
        
    Raises:
        ValidationException: If update fails
    """
    try:
        # Update user data
        updated_user = await user_service.update_user(
            user_id=user_id,
            update_data=update_data
        )
        
        # Log user update
        await audit_logger.log_security_event(
            event_type="user_updated",
            user_id=str(user_id),
            details={"updated_fields": list(update_data.keys())}
        )
        
        return updated_user
        
    except Exception as e:
        logger.error(f"User update failed: {str(e)}")
        raise ValidationException(
            message="Failed to update user data",
            error_code=ErrorCodes.AUTH_FAILED.value
        )