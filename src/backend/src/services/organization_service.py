"""
Service layer implementation for organization management in the COREos platform.
Provides secure, optimized business logic with comprehensive audit logging.

Version: 1.0.0
"""

from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from uuid import UUID
import logging
from datetime import datetime

from circuitbreaker import CircuitBreaker  # v1.4+
from security_manager import SecurityManager  # v1.0+

from data.repositories.organization import OrganizationRepository
from utils.cache import CacheManager
from utils.exceptions import (
    AuthenticationException,
    NotFoundException,
    ValidationException
)
from utils.constants import CACHE_TTL_SECONDS

class OrganizationService:
    """
    Service class implementing business logic for organization management with 
    enhanced security, caching, and audit logging.
    """

    def __init__(
        self,
        repository: OrganizationRepository,
        logger: logging.Logger,
        cache_manager: CacheManager,
        security_manager: SecurityManager
    ) -> None:
        """Initialize organization service with required dependencies."""
        self._repository = repository
        self._logger = logger
        self._cache_manager = cache_manager
        self._security_manager = security_manager
        self._cache_prefix = "org"
        self._cache_ttl = CACHE_TTL_SECONDS

    @asynccontextmanager
    @CircuitBreaker(failure_threshold=5, recovery_timeout=60)
    async def get_organization(self, org_id: UUID, user_id: UUID) -> Dict:
        """
        Retrieve organization by ID with caching and security validation.

        Args:
            org_id: Organization identifier
            user_id: User requesting the organization

        Returns:
            Dict: Organization data

        Raises:
            AuthenticationException: If user lacks permissions
            NotFoundException: If organization not found
        """
        try:
            # Validate user permissions
            if not await self._security_manager.can_access_organization(user_id, org_id):
                raise AuthenticationException(
                    message="User not authorized to access organization",
                    error_code="org_auth_001",
                    details={"user_id": str(user_id), "org_id": str(org_id)}
                )

            # Check cache first
            cache_key = f"{self._cache_prefix}:id:{str(org_id)}"
            cached_org = await self._cache_manager.get_cached(cache_key)
            if cached_org:
                self._logger.debug(f"Cache hit for organization {org_id}")
                yield cached_org
                return

            # Retrieve from repository
            async with self._repository.get_by_id(org_id) as org:
                if not org:
                    raise NotFoundException(
                        message=f"Organization not found: {org_id}",
                        error_code="org_404",
                        details={"org_id": str(org_id)}
                    )

                # Convert to dict and cache
                org_dict = org.to_dict(include_relationships=True)
                await self._cache_manager.set_cached(
                    cache_key,
                    org_dict,
                    ttl=self._cache_ttl
                )

                self._logger.info(f"Retrieved organization {org_id}")
                yield org_dict

        except Exception as e:
            self._logger.error(f"Error retrieving organization {org_id}: {str(e)}")
            raise

    @asynccontextmanager
    @CircuitBreaker(failure_threshold=5, recovery_timeout=60)
    async def get_organizations(
        self,
        user_id: UUID,
        filters: Optional[Dict] = None,
        page: int = 1,
        size: int = 50
    ) -> List[Dict]:
        """
        Retrieve organizations with filtering and pagination.

        Args:
            user_id: User requesting organizations
            filters: Optional filter conditions
            page: Page number (default: 1)
            size: Page size (default: 50)

        Returns:
            List[Dict]: List of organization data

        Raises:
            ValidationException: If pagination parameters invalid
        """
        try:
            # Validate pagination parameters
            if page < 1 or size < 1 or size > 100:
                raise ValidationException(
                    message="Invalid pagination parameters",
                    error_code="org_val_001",
                    details={"page": page, "size": size}
                )

            # Get organizations with caching
            cache_key = (
                f"{self._cache_prefix}:list:"
                f"page:{page}:size:{size}:"
                f"filters:{hash(str(filters))}"
            )
            cached_orgs = await self._cache_manager.get_cached(cache_key)
            if cached_orgs:
                self._logger.debug("Cache hit for organizations list")
                yield cached_orgs
                return

            # Retrieve from repository
            async with self._repository.get_all(
                filters=filters,
                page=page,
                size=size
            ) as orgs:
                # Convert to dict list and filter by user access
                org_dicts = []
                for org in orgs:
                    if await self._security_manager.can_access_organization(
                        user_id,
                        org.id
                    ):
                        org_dicts.append(org.to_dict())

                # Cache results
                await self._cache_manager.set_cached(
                    cache_key,
                    org_dicts,
                    ttl=self._cache_ttl
                )

                self._logger.info(
                    f"Retrieved {len(org_dicts)} organizations "
                    f"(page {page}, size {size})"
                )
                yield org_dicts

        except Exception as e:
            self._logger.error(f"Error retrieving organizations: {str(e)}")
            raise

    @asynccontextmanager
    @CircuitBreaker(failure_threshold=5, recovery_timeout=60)
    async def create_organization(
        self,
        user_id: UUID,
        org_data: Dict
    ) -> Dict:
        """
        Create new organization with validation.

        Args:
            user_id: User creating the organization
            org_data: Organization data

        Returns:
            Dict: Created organization data

        Raises:
            ValidationException: If organization data invalid
        """
        try:
            # Validate user permissions
            if not await self._security_manager.can_create_organization(user_id):
                raise AuthenticationException(
                    message="User not authorized to create organization",
                    error_code="org_auth_002",
                    details={"user_id": str(user_id)}
                )

            # Create organization
            async with self._repository.create(org_data) as org:
                org_dict = org.to_dict()

                # Clear relevant caches
                await self._cache_manager.clear_pattern(f"{self._cache_prefix}:list:*")

                self._logger.info(
                    f"Created organization {org.id}",
                    extra={"user_id": str(user_id)}
                )
                yield org_dict

        except Exception as e:
            self._logger.error(f"Error creating organization: {str(e)}")
            raise

    @asynccontextmanager
    @CircuitBreaker(failure_threshold=5, recovery_timeout=60)
    async def update_organization(
        self,
        org_id: UUID,
        user_id: UUID,
        org_data: Dict
    ) -> Dict:
        """
        Update organization with validation.

        Args:
            org_id: Organization identifier
            user_id: User updating the organization
            org_data: Updated organization data

        Returns:
            Dict: Updated organization data

        Raises:
            AuthenticationException: If user lacks permissions
            NotFoundException: If organization not found
        """
        try:
            # Validate user permissions
            if not await self._security_manager.can_update_organization(user_id, org_id):
                raise AuthenticationException(
                    message="User not authorized to update organization",
                    error_code="org_auth_003",
                    details={"user_id": str(user_id), "org_id": str(org_id)}
                )

            # Update organization
            async with self._repository.update(org_id, org_data) as org:
                org_dict = org.to_dict()

                # Clear relevant caches
                cache_key = f"{self._cache_prefix}:id:{str(org_id)}"
                await self._cache_manager.delete_cache(cache_key)
                await self._cache_manager.clear_pattern(f"{self._cache_prefix}:list:*")

                self._logger.info(
                    f"Updated organization {org_id}",
                    extra={"user_id": str(user_id)}
                )
                yield org_dict

        except Exception as e:
            self._logger.error(f"Error updating organization {org_id}: {str(e)}")
            raise

    @asynccontextmanager
    @CircuitBreaker(failure_threshold=5, recovery_timeout=60)
    async def delete_organization(self, org_id: UUID, user_id: UUID) -> bool:
        """
        Soft delete organization.

        Args:
            org_id: Organization identifier
            user_id: User deleting the organization

        Returns:
            bool: True if deleted successfully

        Raises:
            AuthenticationException: If user lacks permissions
            NotFoundException: If organization not found
        """
        try:
            # Validate user permissions
            if not await self._security_manager.can_delete_organization(user_id, org_id):
                raise AuthenticationException(
                    message="User not authorized to delete organization",
                    error_code="org_auth_004",
                    details={"user_id": str(user_id), "org_id": str(org_id)}
                )

            # Soft delete organization
            async with self._repository.delete(org_id) as deleted:
                if deleted:
                    # Clear relevant caches
                    cache_key = f"{self._cache_prefix}:id:{str(org_id)}"
                    await self._cache_manager.delete_cache(cache_key)
                    await self._cache_manager.clear_pattern(f"{self._cache_prefix}:list:*")

                    self._logger.info(
                        f"Deleted organization {org_id}",
                        extra={"user_id": str(user_id)}
                    )
                yield deleted

        except Exception as e:
            self._logger.error(f"Error deleting organization {org_id}: {str(e)}")
            raise

    @asynccontextmanager
    @CircuitBreaker(failure_threshold=5, recovery_timeout=60)
    async def update_organization_settings(
        self,
        org_id: UUID,
        user_id: UUID,
        settings: Dict
    ) -> Dict:
        """
        Update organization settings.

        Args:
            org_id: Organization identifier
            user_id: User updating settings
            settings: New settings dictionary

        Returns:
            Dict: Updated organization settings

        Raises:
            AuthenticationException: If user lacks permissions
            NotFoundException: If organization not found
        """
        try:
            # Validate user permissions
            if not await self._security_manager.can_update_organization(user_id, org_id):
                raise AuthenticationException(
                    message="User not authorized to update organization settings",
                    error_code="org_auth_005",
                    details={"user_id": str(user_id), "org_id": str(org_id)}
                )

            # Update settings
            async with self._repository.update_settings(org_id, settings) as org:
                # Clear relevant caches
                cache_key = f"{self._cache_prefix}:id:{str(org_id)}"
                await self._cache_manager.delete_cache(cache_key)

                self._logger.info(
                    f"Updated settings for organization {org_id}",
                    extra={"user_id": str(user_id)}
                )
                yield org.settings

        except Exception as e:
            self._logger.error(
                f"Error updating settings for organization {org_id}: {str(e)}"
            )
            raise