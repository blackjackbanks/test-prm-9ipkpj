"""
Repository implementation for managing business context data and AI-processed insights.
Provides CRUD operations and specialized queries for context data management.

Version: 1.0.0
"""

from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.dialects.postgresql import json_contains, json_extract_path_text

from data.repositories.base import BaseRepository
from data.models.context import Context
from utils.constants import CACHE_TTL_SECONDS
from utils.exceptions import ValidationException

class ContextRepository(BaseRepository[Context]):
    """
    Repository for managing context data with specialized queries, optimized search 
    capabilities, and organization-specific data access patterns.
    """

    def __init__(self, cache_ttl: int = CACHE_TTL_SECONDS):
        """
        Initialize context repository with Context model and configure caching.

        Args:
            cache_ttl (int): Cache time-to-live in seconds
        """
        super().__init__(Context)
        self._cache_ttl = cache_ttl

    @asynccontextmanager
    async def get_by_organization(
        self, 
        organization_id: UUID, 
        use_cache: bool = True
    ) -> List[Context]:
        """
        Retrieve all context entries for an organization with caching.

        Args:
            organization_id (UUID): Organization identifier
            use_cache (bool): Whether to use cache for query results

        Returns:
            List[Context]: List of context entries for the organization

        Raises:
            ValidationException: If organization_id is invalid
        """
        try:
            # Build optimized query with organization filter
            query = (
                select(self._model_class)
                .where(
                    and_(
                        self._model_class.organization_id == organization_id,
                        self._model_class.is_deleted.is_(False)
                    )
                )
                .order_by(self._model_class.updated_at.desc())
            )

            async with self._get_session() as session:
                result = await session.execute(query)
                contexts = result.scalars().all()
                yield contexts

        except Exception as e:
            raise ValidationException(
                message=f"Error retrieving contexts for organization: {str(e)}",
                error_code="context_001",
                details={"organization_id": str(organization_id)}
            )

    @asynccontextmanager
    async def get_by_type(
        self, 
        type: str, 
        organization_id: Optional[UUID] = None,
        use_cache: bool = True
    ) -> List[Context]:
        """
        Retrieve context entries by type with optional organization filter.

        Args:
            type (str): Context type to filter by
            organization_id (Optional[UUID]): Optional organization filter
            use_cache (bool): Whether to use cache for query results

        Returns:
            List[Context]: List of context entries of specified type

        Raises:
            ValidationException: If type is invalid
        """
        try:
            # Build base query with type filter
            conditions = [
                self._model_class.type == type,
                self._model_class.is_deleted.is_(False)
            ]

            # Add organization filter if provided
            if organization_id:
                conditions.append(self._model_class.organization_id == organization_id)

            query = (
                select(self._model_class)
                .where(and_(*conditions))
                .order_by(self._model_class.updated_at.desc())
            )

            async with self._get_session() as session:
                result = await session.execute(query)
                contexts = result.scalars().all()
                yield contexts

        except Exception as e:
            raise ValidationException(
                message=f"Error retrieving contexts by type: {str(e)}",
                error_code="context_002",
                details={"type": type, "organization_id": str(organization_id) if organization_id else None}
            )

    @asynccontextmanager
    async def search_content(
        self, 
        search_criteria: Dict[str, Any],
        organization_id: Optional[UUID] = None,
        use_cache: bool = True
    ) -> List[Context]:
        """
        Search context entries by content fields using PostgreSQL JSON operators.

        Args:
            search_criteria (Dict[str, Any]): Search criteria for content fields
            organization_id (Optional[UUID]): Optional organization filter
            use_cache (bool): Whether to use cache for query results

        Returns:
            List[Context]: List of matching context entries

        Raises:
            ValidationException: If search criteria is invalid
        """
        try:
            # Validate search criteria
            if not isinstance(search_criteria, dict):
                raise ValueError("Search criteria must be a dictionary")

            # Build base conditions
            conditions = [self._model_class.is_deleted.is_(False)]

            # Add organization filter if provided
            if organization_id:
                conditions.append(self._model_class.organization_id == organization_id)

            # Add content search conditions using JSON operators
            for field, value in search_criteria.items():
                if isinstance(value, (str, int, float, bool)):
                    # Direct value comparison
                    conditions.append(
                        json_extract_path_text(
                            self._model_class.content, 
                            field
                        ).astext == str(value)
                    )
                elif isinstance(value, dict):
                    # Nested JSON containment
                    conditions.append(
                        json_contains(
                            self._model_class.content[field].astext, 
                            value
                        )
                    )

            # Build and execute optimized query
            query = (
                select(self._model_class)
                .where(and_(*conditions))
                .order_by(self._model_class.updated_at.desc())
            )

            async with self._get_session() as session:
                result = await session.execute(query)
                contexts = result.scalars().all()
                yield contexts

        except ValueError as e:
            raise ValidationException(
                message=str(e),
                error_code="context_003",
                details={"search_criteria": search_criteria}
            )
        except Exception as e:
            raise ValidationException(
                message=f"Error searching contexts: {str(e)}",
                error_code="context_004",
                details={
                    "search_criteria": search_criteria,
                    "organization_id": str(organization_id) if organization_id else None
                }
            )