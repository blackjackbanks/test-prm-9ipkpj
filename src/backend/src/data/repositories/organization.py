"""
Organization repository implementation providing database operations and business logic
for managing organizations in the COREos platform with enhanced features for data management,
caching, and audit logging.

Version: 1.0.0
"""

from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Union
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, and_, or_
from python_audit_logger import AuditLogger  # v1.0.0+

from data.repositories.base import BaseRepository
from data.models.organization import Organization
from utils.exceptions import NotFoundException
from utils.cache import cache

class OrganizationRepository(BaseRepository[Organization]):
    """
    Enhanced repository class for managing Organization entities with caching,
    audit logging and optimized operations.
    """

    def __init__(self):
        """Initialize organization repository with Organization model and audit logger."""
        super().__init__(Organization)
        self._audit_logger = AuditLogger(source="organization_repository")
        self._cache_prefix = "org"
        self._cache_ttl = 3600  # 1 hour default TTL

    @asynccontextmanager
    @cache(ttl=3600)
    async def get_by_name(self, name: str) -> Optional[Organization]:
        """
        Retrieve organization by name with caching.

        Args:
            name: Organization name to search for

        Returns:
            Optional[Organization]: Found organization or None

        Raises:
            NotFoundException: If organization not found
        """
        try:
            # Build optimized query with name filter
            query = (
                select(Organization)
                .where(
                    and_(
                        Organization.name == name,
                        Organization.is_active == True
                    )
                )
            )

            async with self._get_session() as session:
                result = await session.execute(query)
                org = result.scalar_one_or_none()

                if not org:
                    raise NotFoundException(
                        message=f"Organization not found with name: {name}",
                        error_code="org_001",
                        details={"name": name}
                    )

                # Log access for audit trail
                await self._audit_logger.log_access(
                    action="get_by_name",
                    resource_id=str(org.id),
                    details={"name": name}
                )

                yield org

        except Exception as e:
            if not isinstance(e, NotFoundException):
                await self._audit_logger.log_error(
                    action="get_by_name",
                    error=str(e),
                    details={"name": name}
                )
            raise

    @asynccontextmanager
    @cache(ttl=1800)
    async def get_by_industry(
        self,
        industry: str,
        page: int = 1,
        size: int = 50
    ) -> List[Organization]:
        """
        Retrieve organizations by industry with pagination.

        Args:
            industry: Industry to filter by
            page: Page number (default: 1)
            size: Page size (default: 50)

        Returns:
            List[Organization]: List of organizations in the industry
        """
        try:
            # Validate pagination parameters
            if page < 1:
                raise ValueError("Page number must be greater than 0")
            if size < 1 or size > 100:
                raise ValueError("Page size must be between 1 and 100")

            # Build optimized query with industry filter and pagination
            query = (
                select(Organization)
                .where(
                    and_(
                        Organization.industry == industry.lower(),
                        Organization.is_active == True
                    )
                )
                .order_by(Organization.name)
                .offset((page - 1) * size)
                .limit(size)
            )

            async with self._get_session() as session:
                result = await session.execute(query)
                organizations = result.scalars().all()

                # Log access for audit trail
                await self._audit_logger.log_access(
                    action="get_by_industry",
                    details={
                        "industry": industry,
                        "page": page,
                        "size": size,
                        "count": len(organizations)
                    }
                )

                yield organizations

        except Exception as e:
            await self._audit_logger.log_error(
                action="get_by_industry",
                error=str(e),
                details={"industry": industry, "page": page, "size": size}
            )
            raise

    @asynccontextmanager
    async def update_settings(self, id: UUID, settings: Dict) -> Organization:
        """
        Update organization settings with validation and audit logging.

        Args:
            id: Organization ID
            settings: New settings dictionary

        Returns:
            Organization: Updated organization

        Raises:
            NotFoundException: If organization not found
        """
        try:
            async with self._get_session() as session:
                # Start transaction
                async with session.begin():
                    # Get organization
                    org = await self.get_by_id(id)
                    if not org:
                        raise NotFoundException(
                            message=f"Organization not found with ID: {id}",
                            error_code="org_002",
                            details={"id": str(id)}
                        )

                    # Store old settings for audit
                    old_settings = org.settings.copy()

                    # Update settings with validation
                    org.update_settings(settings)

                    # Update database
                    session.add(org)
                    await session.commit()

                    # Clear relevant caches
                    cache_key = f"{self._cache_prefix}:id:{str(id)}"
                    await self._invalidate_cache(cache_key)

                    # Log change for audit trail
                    await self._audit_logger.log_change(
                        action="update_settings",
                        resource_id=str(id),
                        old_value=old_settings,
                        new_value=org.settings,
                        details={"changed_fields": list(settings.keys())}
                    )

                    yield org

        except Exception as e:
            await self._audit_logger.log_error(
                action="update_settings",
                error=str(e),
                details={"id": str(id), "settings": settings}
            )
            raise

    async def _invalidate_cache(self, key: str) -> None:
        """
        Invalidate cache entries for given key pattern.

        Args:
            key: Cache key or pattern to invalidate
        """
        try:
            # Clear exact key and related pattern-based keys
            patterns = [
                key,
                f"{self._cache_prefix}:name:*",
                f"{self._cache_prefix}:industry:*"
            ]
            for pattern in patterns:
                await self._cache.clear_pattern(pattern)

        except Exception as e:
            await self._audit_logger.log_error(
                action="invalidate_cache",
                error=str(e),
                details={"key": key}
            )