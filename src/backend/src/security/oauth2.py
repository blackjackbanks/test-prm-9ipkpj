"""
Enhanced OAuth2 authentication implementation module for COREos platform with advanced security features,
token management, and SSO provider integration support.

Version: 1.0.0
"""

from typing import Dict, Optional, List, Any  # version: 3.11+
from fastapi.security import OAuth2PasswordBearer, OAuth2AuthorizationCodeBearer  # version: 0.100.0
import httpx  # version: 0.24.1
import redis  # version: 4.5.0
from rate_limit import RateLimiter  # version: 2.2.1
import logging
import json
from datetime import datetime, timedelta

from security.jwt import JWTHandler, create_access_token, decode_token, verify_token
from config.security import SecurityConfig
from utils.exceptions import AuthenticationException, IntegrationException
from utils.constants import ErrorCodes

# Configure logger
logger = logging.getLogger("oauth2_security")

# OAuth2 provider configurations with enhanced security settings
OAUTH2_PROVIDERS = {
    'google': {
        'authorize_endpoint': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_endpoint': 'https://oauth2.googleapis.com/token',
        'userinfo_endpoint': 'https://www.googleapis.com/oauth2/v3/userinfo',
        'rate_limit': 100,
        'timeout': 10,
        'scopes': ['openid', 'email', 'profile']
    },
    'microsoft': {
        'authorize_endpoint': 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        'token_endpoint': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        'userinfo_endpoint': 'https://graph.microsoft.com/oidc/userinfo',
        'rate_limit': 100,
        'timeout': 10,
        'scopes': ['openid', 'email', 'profile', 'offline_access']
    },
    'apple': {
        'authorize_endpoint': 'https://appleid.apple.com/auth/authorize',
        'token_endpoint': 'https://appleid.apple.com/auth/token',
        'userinfo_endpoint': 'https://appleid.apple.com/auth/userinfo',
        'rate_limit': 100,
        'timeout': 10,
        'scopes': ['openid', 'email', 'name']
    }
}

class OAuth2Handler:
    """Enhanced OAuth2 authentication handler with advanced security features."""
    
    def __init__(self, security_config: Dict[str, Any]) -> None:
        """
        Initialize OAuth2 handler with enhanced security configuration.
        
        Args:
            security_config: Security configuration parameters
        """
        self._jwt_handler = JWTHandler()
        self._provider_configs = OAUTH2_PROVIDERS
        self._security_config = SecurityConfig()
        
        # Initialize connection-pooled HTTP client
        self._http_client = httpx.AsyncClient(
            timeout=security_config.get('timeout', 10),
            limits=httpx.Limits(max_connections=100)
        )
        
        # Initialize Redis cache client
        self._cache_client = redis.Redis(
            host=security_config.get('redis_host', 'localhost'),
            port=security_config.get('redis_port', 6379),
            db=0,
            decode_responses=True
        )
        
        # Initialize rate limiters for providers
        self._rate_limiters = {
            provider: RateLimiter(
                rate=config['rate_limit'],
                period=60
            ) for provider, config in OAUTH2_PROVIDERS.items()
        }
        
        logger.info("OAuth2 handler initialized with enhanced security")

    async def authenticate_oauth2(
        self,
        provider: str,
        code: str,
        auth_options: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Authenticate user with OAuth2 provider using enhanced security.
        
        Args:
            provider: OAuth2 provider name
            code: Authorization code
            auth_options: Additional authentication options
            
        Returns:
            Dict[str, str]: Authentication tokens with metadata
            
        Raises:
            AuthenticationException: If authentication fails
            IntegrationException: If provider integration fails
        """
        try:
            # Validate provider and check rate limits
            if provider not in self._provider_configs:
                raise AuthenticationException(
                    message=f"Unsupported OAuth2 provider: {provider}",
                    error_code=ErrorCodes.AUTH_FAILED.value
                )
            
            if not self._rate_limiters[provider].try_acquire():
                raise AuthenticationException(
                    message="Rate limit exceeded for OAuth2 provider",
                    error_code=ErrorCodes.RATE_LIMITED.value
                )
            
            # Exchange code for provider tokens
            provider_config = self._provider_configs[provider]
            token_response = await self._http_client.post(
                provider_config['token_endpoint'],
                data={
                    'grant_type': 'authorization_code',
                    'code': code,
                    'client_id': auth_options.get('client_id'),
                    'client_secret': auth_options.get('client_secret'),
                    'redirect_uri': auth_options.get('redirect_uri')
                }
            )
            
            if token_response.status_code != 200:
                raise IntegrationException(
                    message="Failed to exchange authorization code",
                    error_code=ErrorCodes.INTEGRATION_ERROR.value,
                    details={"provider": provider}
                )
            
            tokens = token_response.json()
            
            # Verify ID token and get user info
            user_info = await self._get_user_info(
                provider,
                tokens['access_token']
            )
            
            # Create internal JWT tokens
            access_token = create_access_token(
                data={
                    'sub': user_info['sub'],
                    'email': user_info.get('email'),
                    'provider': provider
                },
                roles=auth_options.get('roles', ['user']),
                permissions=auth_options.get('permissions', {})
            )
            
            # Cache token information
            await self._cache_tokens(
                user_info['sub'],
                access_token,
                tokens.get('refresh_token')
            )
            
            # Log authentication event
            logger.info(
                f"OAuth2 authentication successful for provider {provider}",
                extra={
                    'user_id': user_info['sub'],
                    'provider': provider
                }
            )
            
            return {
                'access_token': access_token,
                'token_type': 'bearer',
                'expires_in': SecurityConfig.TOKEN_EXPIRY
            }
            
        except Exception as e:
            logger.error(f"OAuth2 authentication failed: {str(e)}")
            raise AuthenticationException(
                message="Authentication failed",
                error_code=ErrorCodes.AUTH_FAILED.value,
                details={"error": str(e)}
            )

    async def verify_token_scopes(
        self,
        token: str,
        required_scopes: List[str],
        role_mappings: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Verify OAuth2 token scopes with role mapping.
        
        Args:
            token: JWT token to verify
            required_scopes: Required OAuth2 scopes
            role_mappings: Scope to role mappings
            
        Returns:
            Dict[str, Any]: Scope verification result
        """
        try:
            # Verify token and extract claims
            claims = verify_token(token)
            
            # Extract and validate scopes
            token_scopes = claims.get('scope', '').split()
            
            # Map scopes to roles
            granted_roles = set()
            for scope in token_scopes:
                if scope in role_mappings:
                    granted_roles.update(role_mappings[scope])
            
            # Verify required scopes
            has_required_scopes = all(
                scope in token_scopes for scope in required_scopes
            )
            
            return {
                'valid': has_required_scopes,
                'granted_roles': list(granted_roles),
                'missing_scopes': [
                    scope for scope in required_scopes
                    if scope not in token_scopes
                ]
            }
            
        except Exception as e:
            logger.error(f"Scope verification failed: {str(e)}")
            raise AuthenticationException(
                message="Token scope verification failed",
                error_code=ErrorCodes.INVALID_TOKEN.value
            )

    async def _get_user_info(
        self,
        provider: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Get user information from OAuth2 provider."""
        provider_config = self._provider_configs[provider]
        response = await self._http_client.get(
            provider_config['userinfo_endpoint'],
            headers={'Authorization': f'Bearer {access_token}'}
        )
        
        if response.status_code != 200:
            raise IntegrationException(
                message="Failed to get user information",
                error_code=ErrorCodes.INTEGRATION_ERROR.value
            )
            
        return response.json()

    async def _cache_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: Optional[str]
    ) -> None:
        """Cache token information in Redis."""
        cache_key = f"tokens:{user_id}"
        token_data = {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'created_at': datetime.utcnow().isoformat()
        }
        
        await self._cache_client.setex(
            cache_key,
            SecurityConfig.TOKEN_EXPIRY,
            json.dumps(token_data)
        )

def get_oauth2_scheme(
    provider: str,
    security_options: Dict[str, Any]
) -> OAuth2AuthorizationCodeBearer:
    """
    Create OAuth2 authentication scheme for provider.
    
    Args:
        provider: OAuth2 provider name
        security_options: Security configuration options
        
    Returns:
        OAuth2AuthorizationCodeBearer: Configured OAuth2 scheme
    """
    if provider not in OAUTH2_PROVIDERS:
        raise ValueError(f"Unsupported OAuth2 provider: {provider}")
        
    provider_config = OAUTH2_PROVIDERS[provider]
    
    return OAuth2AuthorizationCodeBearer(
        authorizationUrl=provider_config['authorize_endpoint'],
        tokenUrl=provider_config['token_endpoint'],
        scopes={scope: scope for scope in provider_config['scopes']},
        auto_error=security_options.get('auto_error', True)
    )

async def verify_oauth2_token(
    token: str,
    provider: str,
    validation_options: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Verify OAuth2 token with provider.
    
    Args:
        token: Token to verify
        provider: OAuth2 provider name
        validation_options: Token validation options
        
    Returns:
        Dict[str, Any]: Validated token claims
    """
    handler = OAuth2Handler(validation_options)
    return await handler.verify_token_scopes(
        token,
        validation_options.get('required_scopes', []),
        validation_options.get('role_mappings', {})
    )