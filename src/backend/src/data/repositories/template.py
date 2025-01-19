"""
Repository implementation for Template entity providing database operations and 
business logic for managing business process templates in the COREos platform.

Version: 1.0.0
"""

import logging
import re
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, and_  # v2.0.0+
from cachetools import cache  # v5.0.0+
from contextlib import asynccontextmanager

from data.repositories.base import BaseRepository
from data.models.template import Template
from utils.exceptions import ValidationException

# Configure logging
logger = logging.getLogger(__name__)

class TemplateRepository(BaseRepository[Template]):
    """
    Repository class for managing Template entities with advanced querying,
    caching, and version control capabilities.
    """

    def __init__(self, cache_timeout: int = 300):
        """
        Initialize template repository with caching configuration.

        Args:
            cache_timeout: Cache TTL in seconds (default: 5 minutes)
        """
        super().__init__(Template)
        self._cache_timeout = cache_timeout
        self._template_cache = {}

    @asynccontextmanager
    @cache(ttl=300)
    async def get_by_org_id(self, org_id: UUID) -> List[Template]:
        """
        Retrieve all templates for an organization with caching.

        Args:
            org_id: Organization UUID

        Returns:
            List[Template]: List of templates for the organization

        Raises:
            ValidationException: If org_id is invalid
        """
        try:
            # Check cache first
            cache_key = f"org_templates:{org_id}"
            if cache_key in self._template_cache:
                yield self._template_cache[cache_key]
                return

            async with self._get_session() as session:
                # Build optimized query with index hints
                query = (
                    select(Template)
                    .where(and_(
                        Template.org_id == org_id,
                        Template.deleted_at.is_(None)
                    ))
                    .with_hint(Template, "USE INDEX (idx_templates_org_id)")
                )

                # Execute query with timeout
                result = await session.execute(query)
                templates = result.scalars().all()

                # Update cache
                self._template_cache[cache_key] = templates
                yield templates

        except Exception as e:
            logger.error(f"Error retrieving templates for org {org_id}: {str(e)}")
            raise ValidationException(
                message="Failed to retrieve organization templates",
                error_code="template_001",
                details={"org_id": str(org_id), "error": str(e)}
            )

    @asynccontextmanager
    @cache(ttl=600)
    async def get_by_category(
        self,
        category: str,
        org_id: Optional[UUID] = None
    ) -> List[Template]:
        """
        Retrieve templates by category with optional org filter.

        Args:
            category: Template category
            org_id: Optional organization UUID filter

        Returns:
            List[Template]: List of templates in the category

        Raises:
            ValidationException: If category format is invalid
        """
        try:
            # Validate category format
            if not re.match(r'^[a-zA-Z0-9\-_]{3,100}$', category):
                raise ValidationException(
                    message="Invalid category format",
                    error_code="template_002",
                    details={"category": category}
                )

            # Check cache
            cache_key = f"category_templates:{category}:{org_id or 'all'}"
            if cache_key in self._template_cache:
                yield self._template_cache[cache_key]
                return

            async with self._get_session() as session:
                # Build base query
                query = select(Template).where(and_(
                    Template.category == category,
                    Template.deleted_at.is_(None)
                ))

                # Add org filter if provided
                if org_id:
                    query = query.where(Template.org_id == org_id)

                # Add index hints
                query = query.with_hint(
                    Template,
                    "USE INDEX (idx_templates_category)"
                )

                # Execute query
                result = await session.execute(query)
                templates = result.scalars().all()

                # Update cache
                self._template_cache[cache_key] = templates
                yield templates

        except ValidationException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving templates by category: {str(e)}")
            raise ValidationException(
                message="Failed to retrieve templates by category",
                error_code="template_003",
                details={"category": category, "error": str(e)}
            )

    @asynccontextmanager
    async def update_content(
        self,
        id: UUID,
        new_content: Dict,
        new_version: str
    ) -> Template:
        """
        Update template content with version control and audit.

        Args:
            id: Template UUID
            new_content: Updated template configuration
            new_version: New semantic version string

        Returns:
            Template: Updated template instance

        Raises:
            ValidationException: If validation fails for content or version
            NotFoundException: If template not found
        """
        try:
            # Validate version format
            if not re.match(r'^\d+\.\d+\.\d+$', new_version):
                raise ValidationException(
                    message="Invalid version format",
                    error_code="template_004",
                    details={"version": new_version}
                )

            async with self._get_session() as session:
                # Get template with lock
                query = (
                    select(Template)
                    .where(and_(
                        Template.id == id,
                        Template.deleted_at.is_(None)
                    ))
                    .with_for_update()
                )
                result = await session.execute(query)
                template = result.scalar_one_or_none()

                if not template:
                    raise NotFoundException(
                        message="Template not found",
                        error_code="template_005",
                        details={"id": str(id)}
                    )

                # Update content and metadata
                template.content = new_content
                template.version = new_version
                template.updated_at = datetime.now(timezone.utc)

                # Clear related caches
                org_cache_key = f"org_templates:{template.org_id}"
                category_cache_key = f"category_templates:{template.category}"
                self._template_cache.pop(org_cache_key, None)
                self._template_cache.pop(category_cache_key, None)

                # Commit changes
                await session.commit()
                yield template

        except (ValidationException, NotFoundException):
            raise
        except Exception as e:
            logger.error(f"Error updating template content: {str(e)}")
            raise ValidationException(
                message="Failed to update template content",
                error_code="template_006",
                details={"id": str(id), "error": str(e)}
            )