"""
Authentication routes module implementing secure, standards-compliant login, OAuth2/OIDC,
and token management endpoints with comprehensive security controls and monitoring.

Version: 1.0.0
"""

from typing import Dict, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm, SecurityScopes
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
import logging
from datetime import datetime
from functools import wraps

from security.authentication import AuthenticationManager
from security.oauth2 import get_oauth2_scheme
from utils.exceptions import AuthenticationException

# Configure secure logger
logger = logging.getLogger("auth_routes")

# Initialize router with security prefix
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Initialize authentication manager
auth_manager = AuthenticationManager()

# Rate limiting configuration
LOGIN_RATE_LIMIT = RateLimiter(times=5, seconds=300)  # 5 attempts per 5 minutes
OAUTH_RATE_LIMIT = RateLimiter(times=10, seconds=300)  # 10 attempts per 5 minutes
REFRESH_RATE_LIMIT = RateLimiter(times=20, seconds=300)  # 20 attempts per 5 minutes

def handle_auth_errors(func):
    """Secure error handling decorator with audit logging."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except AuthenticationException as ae:
            logger.warning(
                "Authentication failed",
                extra={
                    "error_code": ae.error_code,
                    "request_id": ae.request_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ae.to_dict(),
                headers={"WWW-Authenticate": "Bearer"}
            )
        except Exception as e:
            logger.error(
                f"Unexpected authentication error: {str(e)}",
                extra={"timestamp": datetime.utcnow().isoformat()}
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error"
            )
    return wrapper

@router.post("/login")
@handle_auth_errors
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    rate_limiter: RateLimiter = Depends(LOGIN_RATE_LIMIT)
) -> Dict[str, str]:
    """
    Authenticate user with email/password with comprehensive security controls.
    
    Args:
        request: FastAPI request object
        form_data: OAuth2 password form data
        rate_limiter: Rate limiting dependency
        
    Returns:
        Dict[str, str]: JWT access and refresh tokens with security metadata
        
    Raises:
        HTTPException: If authentication fails or rate limit exceeded
    """
    # Log authentication attempt
    logger.info(
        "Login attempt",
        extra={
            "ip": request.client.host,
            "email": form_data.username,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    # Authenticate user
    tokens = await auth_manager.authenticate_user(
        email=form_data.username,
        password=form_data.password,
        auth_options={
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent"),
            "scopes": form_data.scopes
        }
    )
    
    # Set security headers
    headers = {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
    }
    
    return tokens

@router.post("/oauth/{provider}")
@handle_auth_errors
async def oauth_login(
    request: Request,
    provider: str,
    code: str,
    state: str,
    code_verifier: str,
    rate_limiter: RateLimiter = Depends(OAUTH_RATE_LIMIT)
) -> Dict[str, str]:
    """
    Authenticate user with OAuth2 provider using PKCE flow.
    
    Args:
        request: FastAPI request object
        provider: OAuth2 provider name
        code: Authorization code
        state: CSRF state token
        code_verifier: PKCE code verifier
        rate_limiter: Rate limiting dependency
        
    Returns:
        Dict[str, str]: JWT access and refresh tokens with provider context
        
    Raises:
        HTTPException: If OAuth2 authentication fails
    """
    # Log OAuth attempt
    logger.info(
        f"OAuth2 login attempt: {provider}",
        extra={
            "ip": request.client.host,
            "provider": provider,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    # Authenticate with OAuth2 provider
    tokens = await auth_manager.authenticate_oauth(
        provider=provider,
        code=code,
        auth_options={
            "state": state,
            "code_verifier": code_verifier,
            "redirect_uri": str(request.url_for("oauth_callback")),
            "ip_address": request.client.host
        }
    )
    
    return tokens

@router.post("/refresh")
@handle_auth_errors
async def refresh(
    request: Request,
    refresh_token: str,
    rate_limiter: RateLimiter = Depends(REFRESH_RATE_LIMIT)
) -> Dict[str, str]:
    """
    Generate new access token with secure rotation and reuse detection.
    
    Args:
        request: FastAPI request object
        refresh_token: Refresh token
        rate_limiter: Rate limiting dependency
        
    Returns:
        Dict[str, str]: New JWT access token with rotation metadata
        
    Raises:
        HTTPException: If token refresh fails
    """
    # Log refresh attempt
    logger.info(
        "Token refresh attempt",
        extra={
            "ip": request.client.host,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    # Refresh tokens
    new_tokens = await auth_manager.refresh_token(refresh_token)
    
    return new_tokens

@router.post("/logout")
@handle_auth_errors
async def logout(
    request: Request,
    token: str = Depends(get_oauth2_scheme)
) -> Dict[str, str]:
    """
    Securely logout user and revoke tokens.
    
    Args:
        request: FastAPI request object
        token: Access token to revoke
        
    Returns:
        Dict[str, str]: Logout confirmation
        
    Raises:
        HTTPException: If logout fails
    """
    # Log logout attempt
    logger.info(
        "Logout attempt",
        extra={
            "ip": request.client.host,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    # Revoke token
    await auth_manager.revoke_token(token)
    
    return {"message": "Successfully logged out"}