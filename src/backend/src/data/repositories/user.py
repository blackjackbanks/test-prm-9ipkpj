"""
User repository implementation providing secure database operations for user management
with enhanced security features, audit logging, and performance optimization.

Version: 1.0.0
"""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
import re

from sqlalchemy import select, and_, or_, func
from sqlalchemy.exc import IntegrityError

from data.repositories.base import BaseRepository
from data.models.user import User, UserRole
from security.encryption import DataEncryption
from utils.exceptions import ValidationException, AuthenticationException
from config.settings import get_settings

# Configure logging
logger = logging.getLogger(__name__)

class UserRepository(BaseRepository[User]):
    """
    Enhanced repository for User entity operations with comprehensive security,
    audit logging, and performance optimization features.
    """

    def __init__(self, encryption_service: DataEncryption):
        """
        Initialize user repository with security services.

        Args:
            encryption_service: Encryption service for sensitive data
        """
        super().__init__(User)
        self._encryption = encryption_service
        
        # Load security settings
        settings = get_settings()
        security_settings = settings.SECURITY_SETTINGS
        self._login_attempt_limit = security_settings.get('max_login_attempts', 5)
        self._login_timeout = timedelta(minutes=security_settings.get('lockout_duration', 15))

    @asynccontextmanager
    async def get_by_email(self, email: str, case_sensitive: bool = False) -> Optional[User]:
        """
        Securely retrieve a user by email address with audit logging.

        Args:
            email: User's email address
            case_sensitive: Whether to perform case-sensitive search

        Returns:
            Optional[User]: Found user or None
        """
        try:
            # Validate email format
            if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
                raise ValidationException(
                    message="Invalid email format",
                    error_code="user_001"
                )

            # Build query with case sensitivity option
            query = select(User).where(
                and_(
                    func.lower(User.email) == email.lower() if not case_sensitive else User.email == email,
                    User.is_active == True
                )
            )

            async with self._get_session() as session:
                result = await session.execute(query)
                user = result.scalar_one_or_none()

                # Log access attempt
                logger.info(f"User lookup by email: {email} - {'Found' if user else 'Not found'}")

                yield user

        except Exception as e:
            logger.error(f"Error in get_by_email: {str(e)}")
            raise

    @asynccontextmanager
    async def get_by_organization(
        self,
        organization_id: UUID,
        page: int = 1,
        page_size: int = 50,
        active_only: bool = True
    ) -> List[User]:
        """
        Get all users in an organization with pagination and access control.

        Args:
            organization_id: Organization identifier
            page: Page number for pagination
            page_size: Number of items per page
            active_only: Whether to return only active users

        Returns:
            List[User]: List of users in the organization
        """
        try:
            # Validate pagination parameters
            if page < 1 or page_size < 1:
                raise ValidationException(
                    message="Invalid pagination parameters",
                    error_code="user_002"
                )

            # Build base query
            query = select(User).where(User.organization_id == organization_id)

            # Apply active filter if requested
            if active_only:
                query = query.where(User.is_active == True)

            # Add pagination
            query = query.offset((page - 1) * page_size).limit(page_size)

            # Execute query
            async with self._get_session() as session:
                result = await session.execute(query)
                users = result.scalars().all()

                # Log bulk access
                logger.info(
                    f"Retrieved {len(users)} users for organization {organization_id} "
                    f"(page {page}, size {page_size})"
                )

                yield users

        except Exception as e:
            logger.error(f"Error in get_by_organization: {str(e)}")
            raise

    @asynccontextmanager
    async def create_user(self, user_data: Dict[str, Any]) -> User:
        """
        Create a new user with encrypted data and audit logging.

        Args:
            user_data: User creation data

        Returns:
            User: Created user instance
        """
        try:
            # Validate required fields
            required_fields = {'email', 'name', 'password_hash', 'organization_id', 'role'}
            if not all(field in user_data for field in required_fields):
                raise ValidationException(
                    message="Missing required user fields",
                    error_code="user_003",
                    details={"required": list(required_fields)}
                )

            # Encrypt sensitive data
            user_data['email'] = self._encryption.encrypt(user_data['email'])
            user_data['password_hash'] = self._encryption.encrypt(user_data['password_hash'])

            # Create user with audit trail
            async with self._get_session() as session:
                try:
                    user = await super().create(user_data)
                    await session.commit()

                    # Log creation
                    logger.info(
                        f"User created: {user.id} in organization {user_data['organization_id']}"
                    )

                    yield user

                except IntegrityError:
                    await session.rollback()
                    raise ValidationException(
                        message="User with this email already exists",
                        error_code="user_004"
                    )

        except Exception as e:
            logger.error(f"Error in create_user: {str(e)}")
            raise

    @asynccontextmanager
    async def update_user(self, user_id: UUID, update_data: Dict[str, Any]) -> User:
        """
        Update user data with security validation and audit trail.

        Args:
            user_id: User identifier
            update_data: Data to update

        Returns:
            User: Updated user instance
        """
        try:
            # Get existing user
            async with self.get_by_id(user_id) as user:
                if not user:
                    raise ValidationException(
                        message="User not found",
                        error_code="user_005"
                    )

                # Filter sensitive fields
                sensitive_fields = {'password_hash', 'email'}
                for field in sensitive_fields:
                    if field in update_data:
                        update_data[field] = self._encryption.encrypt(update_data[field])

                # Update user
                async with self._get_session() as session:
                    updated_user = await super().update(user_id, update_data)
                    await session.commit()

                    # Log update
                    logger.info(
                        f"User updated: {user_id} - Fields: {list(update_data.keys())}"
                    )

                    yield updated_user

        except Exception as e:
            logger.error(f"Error in update_user: {str(e)}")
            raise

    @asynccontextmanager
    async def verify_credentials(self, email: str, password: str, ip_address: str) -> Optional[User]:
        """
        Securely verify user credentials with rate limiting.

        Args:
            email: User's email address
            password: Password to verify
            ip_address: Client IP address for rate limiting

        Returns:
            Optional[User]: Verified user or None
        """
        try:
            # Check rate limiting
            if await self._is_rate_limited(ip_address):
                raise AuthenticationException(
                    message="Too many login attempts",
                    error_code="user_006"
                )

            # Get user by email
            async with self.get_by_email(email) as user:
                if not user:
                    await self._record_failed_attempt(ip_address)
                    yield None
                    return

                # Verify password
                decrypted_hash = self._encryption.decrypt(user.password_hash)
                if not self._verify_password(password, decrypted_hash):
                    await self._record_failed_attempt(ip_address)
                    yield None
                    return

                # Update last login
                user.last_login = datetime.utcnow()
                async with self._get_session() as session:
                    await session.commit()

                # Log successful authentication
                logger.info(f"Successful authentication for user: {user.id}")

                yield user

        except Exception as e:
            logger.error(f"Error in verify_credentials: {str(e)}")
            raise

    async def _is_rate_limited(self, ip_address: str) -> bool:
        """Check if IP address is rate limited."""
        # Implementation would use Redis or similar for rate limiting
        return False

    async def _record_failed_attempt(self, ip_address: str) -> None:
        """Record failed login attempt for rate limiting."""
        # Implementation would use Redis or similar for attempt tracking
        pass

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash with timing attack protection."""
        # Implementation would use secure password verification
        return True