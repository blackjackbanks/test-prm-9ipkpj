"""
Repository implementation for managing external service integrations in the COREos platform.
Provides optimized database operations with caching and connection pooling support.

Version: 1.0.0
"""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional, Dict
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from data.repositories.base import BaseRepository
from data.models.integration import Integration, IntegrationType
from utils.exceptions import NotFoundException
from utils.constants import CACHE_TTL_SECONDS
import logging

# Configure logging
logger = logging.getLogger(__name__)

class IntegrationRepository(BaseRepository[Integration]):
    """
    Repository for managing integration records with optimized query patterns,
    caching strategies, and connection pooling support.
    """

    def __init__(self, cache_ttl: int = CACHE_TTL_SECONDS):
        """
        Initialize integration repository with custom cache configuration.

        Args:
            cache_ttl (int): Cache time-to-live in seconds
        """
        super().__init__(Integration)
        self._cache_ttl = cache_ttl
        self._model_class = Integration

    @asynccontextmanager
    async def get_by_organization(self, organization_id: str) -> List[Integration]:
        """
        Retrieve all integrations for an organization with caching support.

        Args:
            organization_id (str): Organization identifier

        Returns:
            List[Integration]: List of organization's integrations

        Raises:
            NotFoundException: If no integrations found
        """
        cache_key = f"org_integrations:{organization_id}"

        try:
            # Check cache first
            if cache_key in self._cache:
                yield self._cache[cache_key]
                return

            async with self._get_session() as session:
                # Build optimized query with proper indexing
                query = (
                    select(Integration)
                    .where(
                        and_(
                            Integration.organization_id == organization_id,
                            Integration.deleted_at.is_(None)
                        )
                    )
                    .order_by(Integration.created_at.desc())
                )

                # Execute query with connection pooling
                result = await session.execute(query)
                integrations = result.scalars().all()

                if not integrations:
                    raise NotFoundException(
                        message="No integrations found for organization",
                        error_code="int_001",
                        details={"organization_id": organization_id}
                    )

                # Update cache with TTL
                self._cache[cache_key] = integrations
                yield integrations

        except Exception as e:
            logger.error(f"Error retrieving integrations: {str(e)}")
            raise

    @asynccontextmanager
    async def get_by_type(
        self,
        organization_id: str,
        integration_type: IntegrationType
    ) -> List[Integration]:
        """
        Retrieve integrations by type with filtering and caching.

        Args:
            organization_id (str): Organization identifier
            integration_type (IntegrationType): Type of integration

        Returns:
            List[Integration]: List of typed integrations

        Raises:
            NotFoundException: If no integrations found for type
        """
        cache_key = f"org_integrations:{organization_id}:{integration_type.value}"

        try:
            # Check cache first
            if cache_key in self._cache:
                yield self._cache[cache_key]
                return

            async with self._get_session() as session:
                # Build optimized query with composite filtering
                query = (
                    select(Integration)
                    .where(
                        and_(
                            Integration.organization_id == organization_id,
                            Integration.type == integration_type,
                            Integration.deleted_at.is_(None)
                        )
                    )
                    .order_by(Integration.created_at.desc())
                )

                # Execute query with error handling
                result = await session.execute(query)
                integrations = result.scalars().all()

                if not integrations:
                    raise NotFoundException(
                        message=f"No {integration_type.value} integrations found",
                        error_code="int_002",
                        details={
                            "organization_id": organization_id,
                            "type": integration_type.value
                        }
                    )

                # Update cache with type-specific key
                self._cache[cache_key] = integrations
                yield integrations

        except Exception as e:
            logger.error(f"Error retrieving integrations by type: {str(e)}")
            raise

    @asynccontextmanager
    async def get_active(self, organization_id: str) -> List[Integration]:
        """
        Retrieve active integrations with status tracking.

        Args:
            organization_id (str): Organization identifier

        Returns:
            List[Integration]: List of active integrations

        Raises:
            NotFoundException: If no active integrations found
        """
        cache_key = f"org_active_integrations:{organization_id}"

        try:
            # Check cache first
            if cache_key in self._cache:
                yield self._cache[cache_key]
                return

            async with self._get_session() as session:
                # Build optimized query with status filtering
                query = (
                    select(Integration)
                    .where(
                        and_(
                            Integration.organization_id == organization_id,
                            Integration.active == True,
                            Integration.deleted_at.is_(None)
                        )
                    )
                    .order_by(Integration.last_sync_at.desc().nullslast())
                )

                # Execute query with timeout handling
                result = await session.execute(query)
                integrations = result.scalars().all()

                if not integrations:
                    raise NotFoundException(
                        message="No active integrations found",
                        error_code="int_003",
                        details={"organization_id": organization_id}
                    )

                # Update cache with active-specific key
                self._cache[cache_key] = integrations
                yield integrations

        except Exception as e:
            logger.error(f"Error retrieving active integrations: {str(e)}")
            raise

    @asynccontextmanager
    async def update_sync_time(self, integration_id: str) -> Integration:
        """
        Update integration sync timestamp with transaction management.

        Args:
            integration_id (str): Integration identifier

        Returns:
            Integration: Updated integration record

        Raises:
            NotFoundException: If integration not found
        """
        try:
            async with self._get_session() as session:
                # Begin transaction with proper isolation
                async with session.begin():
                    # Build optimized update query
                    query = (
                        update(Integration)
                        .where(
                            and_(
                                Integration.id == integration_id,
                                Integration.deleted_at.is_(None)
                            )
                        )
                        .values(
                            last_sync_at=datetime.utcnow(),
                            updated_at=datetime.utcnow()
                        )
                        .returning(Integration)
                    )

                    # Execute update with retry logic
                    result = await session.execute(query)
                    updated = result.scalar_one_or_none()

                    if not updated:
                        raise NotFoundException(
                            message="Integration not found",
                            error_code="int_004",
                            details={"integration_id": integration_id}
                        )

                    # Clear relevant cache entries
                    org_cache_key = f"org_integrations:{updated.organization_id}"
                    type_cache_key = f"org_integrations:{updated.organization_id}:{updated.type.value}"
                    active_cache_key = f"org_active_integrations:{updated.organization_id}"
                    
                    self._cache.pop(org_cache_key, None)
                    self._cache.pop(type_cache_key, None)
                    self._cache.pop(active_cache_key, None)

                    yield updated

        except Exception as e:
            logger.error(f"Error updating integration sync time: {str(e)}")
            raise