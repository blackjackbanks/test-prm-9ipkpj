"""
Enhanced JWT token generation, validation and management module with advanced security features
including key rotation, role-based access control, and security audit logging.

Version: 1.0.0
"""

from datetime import datetime, timedelta  # version: 3.11+
from typing import Dict, Optional, List, Any  # version: 3.11+
from jose import jwt, JWTError  # version: python-jose[cryptography] 3.3.0
from cachetools import TTLCache, cached  # version: 5.0.0
import logging  # version: 3.11+
import uuid

from config.security import SecurityConfig
from utils.exceptions import AuthenticationException
from utils.constants import ErrorCodes

# Global configuration
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
REFRESH_TOKEN_EXPIRE_DAYS: int = 7
TOKEN_BLACKLIST_SIZE: int = 10000
MAX_TOKEN_CACHE_SIZE: int = 1000

# Configure logger
logger = logging.getLogger("jwt_security")

class JWTHandler:
    """
    Enhanced JWT token management with advanced security features including
    key rotation, token blacklisting, and security audit logging.
    """
    
    def __init__(self) -> None:
        """Initialize JWT handler with enhanced security configuration"""
        self._security_config = SecurityConfig()
        self._secret_key = self._security_config._secret_key
        self._algorithm = self._security_config._algorithm
        
        # Initialize token blacklist with TTL cache
        self._token_blacklist = TTLCache(
            maxsize=TOKEN_BLACKLIST_SIZE,
            ttl=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
        )
        
        # Initialize token cache
        self._token_cache = TTLCache(
            maxsize=MAX_TOKEN_CACHE_SIZE,
            ttl=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
        # Configure security logger
        self._logger = logging.getLogger("jwt_security")
        self._logger.info("JWT Handler initialized with enhanced security")

    @cached(cache=TTLCache(maxsize=MAX_TOKEN_CACHE_SIZE, ttl=300))
    def create_token(
        self,
        data: Dict[str, Any],
        roles: List[str],
        permissions: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Generate secure JWT token with enhanced claims and security metadata
        
        Args:
            data: Base claims data
            roles: User roles for RBAC
            permissions: Granular permissions
            expires_delta: Optional custom expiration time
            
        Returns:
            str: Encoded JWT token
            
        Raises:
            AuthenticationException: If token creation fails
        """
        try:
            # Create copy of data to avoid mutations
            token_data = data.copy()
            
            # Add expiration time
            expire = datetime.utcnow() + (
                expires_delta if expires_delta
                else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            )
            
            # Add security claims
            token_data.update({
                "exp": expire,
                "iat": datetime.utcnow(),
                "jti": str(uuid.uuid4()),
                "roles": roles,
                "permissions": permissions,
                "token_version": "1.0"
            })
            
            # Generate token
            encoded_token = jwt.encode(
                token_data,
                self._secret_key,
                algorithm=self._algorithm
            )
            
            # Log token creation
            self._logger.info(
                f"Token created for user {data.get('sub')} with roles {roles}",
                extra={
                    "user_id": data.get("sub"),
                    "token_id": token_data["jti"],
                    "roles": roles
                }
            )
            
            return encoded_token
            
        except Exception as e:
            self._logger.error(f"Token creation failed: {str(e)}")
            raise AuthenticationException(
                message="Failed to create authentication token",
                error_code=ErrorCodes.AUTH_FAILED.value,
                details={"error": str(e)}
            )

    def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify and decode JWT token with security checks
        
        Args:
            token: JWT token to verify
            
        Returns:
            Dict[str, Any]: Decoded token claims
            
        Raises:
            AuthenticationException: If token is invalid or expired
        """
        try:
            # Check token blacklist
            if token in self._token_blacklist:
                raise AuthenticationException(
                    message="Token has been revoked",
                    error_code=ErrorCodes.INVALID_TOKEN.value
                )
            
            # Decode and verify token
            payload = jwt.decode(
                token,
                self._secret_key,
                algorithms=[self._algorithm]
            )
            
            # Verify token version
            if payload.get("token_version") != "1.0":
                raise AuthenticationException(
                    message="Invalid token version",
                    error_code=ErrorCodes.INVALID_TOKEN.value
                )
            
            # Log token verification
            self._logger.debug(
                f"Token verified for user {payload.get('sub')}",
                extra={
                    "user_id": payload.get("sub"),
                    "token_id": payload.get("jti")
                }
            )
            
            return payload
            
        except JWTError as e:
            self._logger.warning(f"Token verification failed: {str(e)}")
            raise AuthenticationException(
                message="Invalid authentication token",
                error_code=ErrorCodes.INVALID_TOKEN.value,
                details={"error": str(e)}
            )

    def blacklist_token(self, token: str) -> None:
        """
        Add token to blacklist for revocation
        
        Args:
            token: Token to blacklist
        """
        try:
            # Decode token without verification to get claims
            payload = jwt.get_unverified_claims(token)
            
            # Add to blacklist with expiry
            self._token_blacklist[token] = payload.get("jti")
            
            self._logger.info(
                f"Token blacklisted: {payload.get('jti')}",
                extra={"token_id": payload.get("jti")}
            )
            
        except Exception as e:
            self._logger.error(f"Token blacklisting failed: {str(e)}")

    def rotate_key(self) -> bool:
        """
        Perform secure key rotation
        
        Returns:
            bool: True if rotation successful
        """
        try:
            # Generate new key
            new_key = self._security_config._generate_encryption_key()
            
            # Update secret key
            old_key = self._secret_key
            self._secret_key = new_key
            
            # Clear token cache
            self._token_cache.clear()
            
            self._logger.info("JWT signing key rotated successfully")
            return True
            
        except Exception as e:
            self._logger.error(f"Key rotation failed: {str(e)}")
            return False

    def has_role(self, token: str, required_role: str) -> bool:
        """
        Check if token has required role
        
        Args:
            token: JWT token to check
            required_role: Role to verify
            
        Returns:
            bool: True if token has role
        """
        try:
            payload = self.verify_token(token)
            return required_role in payload.get("roles", [])
        except AuthenticationException:
            return False

    def has_permission(self, token: str, required_permission: str) -> bool:
        """
        Check if token has required permission
        
        Args:
            token: JWT token to check
            required_permission: Permission to verify
            
        Returns:
            bool: True if token has permission
        """
        try:
            payload = self.verify_token(token)
            permissions = payload.get("permissions", {})
            return required_permission in permissions
        except AuthenticationException:
            return False

# Initialize global JWT handler instance
jwt_handler = JWTHandler()

# Export key functions
create_token = jwt_handler.create_token
verify_token = jwt_handler.verify_token
blacklist_token = jwt_handler.blacklist_token
has_role = jwt_handler.has_role
has_permission = jwt_handler.has_permission