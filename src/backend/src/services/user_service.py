"""
Enhanced user service implementation providing secure user lifecycle management,
multi-factor authentication, and organization membership handling with comprehensive
security features and audit logging.

Version: 1.0.0
"""

from uuid import UUID
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from fastapi_limiter import RateLimiter
from python_security_manager import SecurityManager
from python_audit_logger import AuditLogger
import logging

from data.repositories.user import UserRepository
from security.authentication import AuthenticationManager
from utils.exceptions import ValidationException, AuthenticationException
from utils.constants import ErrorCodes

# Configure logging
logger = logging.getLogger(__name__)

class UserService:
    """
    Enhanced service class implementing secure user management business logic 
    with MFA, audit logging, and PII protection.
    """
    
    def __init__(
        self,
        repository: UserRepository,
        auth_manager: AuthenticationManager,
        security_manager: SecurityManager,
        audit_logger: AuditLogger,
        rate_limiter: RateLimiter
    ) -> None:
        """
        Initialize user service with enhanced security components.
        
        Args:
            repository: User data repository
            auth_manager: Authentication manager
            security_manager: Security operations manager
            audit_logger: Security audit logger
            rate_limiter: Rate limiting component
        """
        self._repository = repository
        self._auth_manager = auth_manager
        self._security_manager = security_manager
        self._audit_logger = audit_logger
        self._rate_limiter = rate_limiter
        
        logger.info("UserService initialized with enhanced security features")

    async def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new user with enhanced security measures and audit logging.
        
        Args:
            user_data: User creation data including credentials and organization
            
        Returns:
            Dict[str, Any]: Created user data with sensitive fields masked
            
        Raises:
            ValidationException: If user data is invalid
            AuthenticationException: If security checks fail
        """
        try:
            # Apply rate limiting
            if not await self._rate_limiter.check_rate("create_user"):
                raise ValidationException(
                    message="Rate limit exceeded for user creation",
                    error_code=ErrorCodes.RATE_LIMITED.value
                )

            # Validate required fields
            required_fields = {'email', 'name', 'password', 'organization_id'}
            if not all(field in user_data for field in required_fields):
                raise ValidationException(
                    message="Missing required user fields",
                    error_code="user_001",
                    details={"required": list(required_fields)}
                )

            # Check email uniqueness
            async with self._repository.get_by_email(user_data['email']) as existing_user:
                if existing_user:
                    raise ValidationException(
                        message="Email already registered",
                        error_code="user_002"
                    )

            # Hash password securely
            user_data['password_hash'] = await self._auth_manager._jwt_handler.get_password_hash(
                user_data.pop('password')
            )

            # Encrypt sensitive PII data
            user_data['email'] = self._security_manager.encrypt_pii(user_data['email'])
            user_data['name'] = self._security_manager.encrypt_pii(user_data['name'])

            # Create user with audit trail
            async with self._repository.create_user(user_data) as created_user:
                # Log security audit event
                await self._audit_logger.log_security_event(
                    event_type="user_created",
                    user_id=str(created_user.id),
                    organization_id=str(user_data['organization_id']),
                    details={
                        "email_hash": self._security_manager.hash_identifier(user_data['email'])
                    }
                )

                # Return masked user data
                return created_user.to_dict(include_sensitive=False)

        except Exception as e:
            logger.error(f"User creation failed: {str(e)}")
            raise

    async def authenticate(
        self,
        email: str,
        password: str,
        mfa_code: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Authenticate user with MFA support and comprehensive security checks.
        
        Args:
            email: User email
            password: User password
            mfa_code: Optional MFA verification code
            
        Returns:
            Dict[str, str]: Authentication tokens and MFA status
            
        Raises:
            AuthenticationException: If authentication fails
        """
        try:
            # Apply rate limiting
            if not await self._rate_limiter.check_rate(f"auth_{email}"):
                raise AuthenticationException(
                    message="Rate limit exceeded for authentication attempts",
                    error_code=ErrorCodes.RATE_LIMITED.value
                )

            # Get user and verify credentials
            async with self._repository.get_by_email(email) as user:
                if not user:
                    raise AuthenticationException(
                        message="Invalid credentials",
                        error_code=ErrorCodes.AUTH_FAILED.value
                    )

                # Verify password
                if not await self._auth_manager.verify_password(
                    password,
                    self._security_manager.decrypt_data(user.password_hash)
                ):
                    raise AuthenticationException(
                        message="Invalid credentials",
                        error_code=ErrorCodes.AUTH_FAILED.value
                    )

                # Check MFA if enabled
                if user.mfa_enabled:
                    if not mfa_code:
                        return {
                            "requires_mfa": True,
                            "temp_token": await self._auth_manager.create_temp_token(user.id)
                        }
                    
                    if not await self._auth_manager.verify_mfa(user.id, mfa_code):
                        raise AuthenticationException(
                            message="Invalid MFA code",
                            error_code=ErrorCodes.AUTH_FAILED.value
                        )

                # Generate authentication tokens
                tokens = await self._auth_manager.authenticate_user(
                    str(user.id),
                    self._security_manager.decrypt_data(user.email),
                    user.role
                )

                # Log authentication event
                await self._audit_logger.log_security_event(
                    event_type="user_authenticated",
                    user_id=str(user.id),
                    organization_id=str(user.organization_id),
                    details={"mfa_used": bool(mfa_code)}
                )

                return tokens

        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}")
            raise

    async def authenticate_oauth(
        self,
        provider: str,
        code: str,
        auth_options: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Authenticate user via OAuth2 provider with enhanced security.
        
        Args:
            provider: OAuth2 provider name
            code: Authorization code
            auth_options: Additional authentication options
            
        Returns:
            Dict[str, str]: Authentication tokens
            
        Raises:
            AuthenticationException: If OAuth authentication fails
        """
        try:
            # Verify provider and apply rate limiting
            if not await self._rate_limiter.check_rate(f"oauth_{provider}"):
                raise AuthenticationException(
                    message="Rate limit exceeded for OAuth authentication",
                    error_code=ErrorCodes.RATE_LIMITED.value
                )

            # Authenticate with OAuth provider
            oauth_result = await self._auth_manager.authenticate_oauth(
                provider,
                code,
                auth_options
            )

            # Get or create user from OAuth data
            user_info = oauth_result['user_info']
            async with self._repository.get_by_email(user_info['email']) as user:
                if not user:
                    # Create new user from OAuth data
                    user_data = {
                        'email': user_info['email'],
                        'name': user_info.get('name', ''),
                        'organization_id': auth_options['organization_id'],
                        'oauth_provider': provider,
                        'oauth_id': user_info['sub']
                    }
                    async with self._repository.create_user(user_data) as user:
                        pass

                # Log OAuth authentication
                await self._audit_logger.log_security_event(
                    event_type="oauth_authentication",
                    user_id=str(user.id),
                    organization_id=str(user.organization_id),
                    details={
                        "provider": provider,
                        "oauth_id": user_info['sub']
                    }
                )

                return oauth_result['tokens']

        except Exception as e:
            logger.error(f"OAuth authentication failed: {str(e)}")
            raise

    async def get_user_by_id(self, user_id: UUID) -> Dict[str, Any]:
        """
        Retrieve user by ID with security checks and audit logging.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dict[str, Any]: User data with sensitive fields masked
            
        Raises:
            ValidationException: If user not found
        """
        try:
            async with self._repository.get_by_id(user_id) as user:
                if not user:
                    raise ValidationException(
                        message="User not found",
                        error_code="user_003"
                    )

                # Log access event
                await self._audit_logger.log_security_event(
                    event_type="user_accessed",
                    user_id=str(user_id),
                    organization_id=str(user.organization_id)
                )

                return user.to_dict(include_sensitive=False)

        except Exception as e:
            logger.error(f"User retrieval failed: {str(e)}")
            raise

    async def update_user(
        self,
        user_id: UUID,
        update_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update user data with security validation and audit logging.
        
        Args:
            user_id: User identifier
            update_data: Data to update
            
        Returns:
            Dict[str, Any]: Updated user data
            
        Raises:
            ValidationException: If update data is invalid
        """
        try:
            # Validate update data
            if 'email' in update_data:
                async with self._repository.get_by_email(update_data['email']) as existing:
                    if existing and existing.id != user_id:
                        raise ValidationException(
                            message="Email already registered",
                            error_code="user_004"
                        )

            # Encrypt sensitive updates
            if 'email' in update_data:
                update_data['email'] = self._security_manager.encrypt_pii(
                    update_data['email']
                )
            if 'name' in update_data:
                update_data['name'] = self._security_manager.encrypt_pii(
                    update_data['name']
                )

            # Update user
            async with self._repository.update_user(user_id, update_data) as updated_user:
                # Log update event
                await self._audit_logger.log_security_event(
                    event_type="user_updated",
                    user_id=str(user_id),
                    organization_id=str(updated_user.organization_id),
                    details={"updated_fields": list(update_data.keys())}
                )

                return updated_user.to_dict(include_sensitive=False)

        except Exception as e:
            logger.error(f"User update failed: {str(e)}")
            raise

    async def enable_mfa(self, user_id: UUID) -> Dict[str, Any]:
        """
        Enable MFA for user with secure setup process.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dict[str, Any]: MFA setup information
            
        Raises:
            ValidationException: If MFA setup fails
        """
        try:
            # Generate MFA secret
            mfa_secret = self._security_manager.generate_mfa_secret()
            
            # Update user with encrypted MFA secret
            update_data = {
                'mfa_enabled': True,
                'mfa_secret': self._security_manager.encrypt_data(mfa_secret)
            }
            
            async with self._repository.update_user(user_id, update_data) as updated_user:
                # Log MFA enablement
                await self._audit_logger.log_security_event(
                    event_type="mfa_enabled",
                    user_id=str(user_id),
                    organization_id=str(updated_user.organization_id)
                )

                return {
                    'secret': mfa_secret,
                    'qr_code': self._security_manager.generate_mfa_qr(
                        mfa_secret,
                        updated_user.email
                    )
                }

        except Exception as e:
            logger.error(f"MFA enablement failed: {str(e)}")
            raise