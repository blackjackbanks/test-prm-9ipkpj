"""
Service layer implementation for managing business process templates in the COREos platform.
Provides high-level operations and business logic for template management with enhanced 
versioning, validation, and audit capabilities.

Version: 1.0.0
"""

import logging
from typing import List, Dict, Optional, Tuple
from uuid import UUID
from contextlib import asynccontextmanager
import semver  # v3.0.0+

from data.repositories.template import TemplateRepository
from data.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateInDB,
    TemplateBulkOperation
)
from utils.exceptions import (
    ValidationException,
    NotFoundException,
    VersionConflictException
)

# Configure logging
logger = logging.getLogger(__name__)

# Error messages
ERROR_TEMPLATE_NOT_FOUND = "Template not found"
ERROR_INVALID_VERSION = "Invalid semantic version format"
ERROR_VERSION_CONFLICT = "Template version conflict detected"

# Configuration constants
MAX_BULK_OPERATIONS = 100
TEMPLATE_CACHE_TTL = 3600  # 1 hour

class TemplateService:
    """
    Enhanced service class providing high-level template management operations 
    with versioning, validation, and audit support.
    """

    def __init__(self, repository: TemplateRepository):
        """
        Initialize template service with repository and cache.

        Args:
            repository: Template repository instance
        """
        self._repository = repository
        self._cache: Dict = {}
        logger.info("Template service initialized")

    @asynccontextmanager
    async def get_template(self, template_id: UUID) -> TemplateInDB:
        """
        Retrieve template by ID with caching.

        Args:
            template_id: Template UUID

        Returns:
            TemplateInDB: Template details with audit information

        Raises:
            NotFoundException: If template not found
        """
        try:
            # Check cache first
            cache_key = f"template:{template_id}"
            if cache_key in self._cache:
                yield self._cache[cache_key]
                return

            # Get template from repository
            async with self._repository.get_by_id(template_id) as template:
                if not template:
                    raise NotFoundException(
                        message=ERROR_TEMPLATE_NOT_FOUND,
                        error_code="template_001",
                        details={"template_id": str(template_id)}
                    )

                # Update cache
                template_data = TemplateInDB.from_orm(template)
                self._cache[cache_key] = template_data
                yield template_data

        except NotFoundException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving template {template_id}: {str(e)}")
            raise ValidationException(
                message="Failed to retrieve template",
                error_code="template_002",
                details={"template_id": str(template_id), "error": str(e)}
            )

    @asynccontextmanager
    async def get_org_templates(
        self,
        org_id: UUID,
        category: Optional[str] = None,
        filters: Optional[Dict] = None
    ) -> List[TemplateInDB]:
        """
        Get all templates for an organization with category filtering.

        Args:
            org_id: Organization UUID
            category: Optional category filter
            filters: Additional filters

        Returns:
            List[TemplateInDB]: Filtered list of organization templates
        """
        try:
            # Build cache key
            cache_key = f"org_templates:{org_id}:{category or 'all'}"
            if cache_key in self._cache:
                yield self._cache[cache_key]
                return

            # Get templates from repository
            if category:
                async with self._repository.get_by_category(category, org_id) as templates:
                    template_list = [TemplateInDB.from_orm(t) for t in templates]
            else:
                async with self._repository.get_by_org_id(org_id) as templates:
                    template_list = [TemplateInDB.from_orm(t) for t in templates]

            # Apply additional filters
            if filters:
                template_list = [
                    t for t in template_list
                    if all(getattr(t, k, None) == v for k, v in filters.items())
                ]

            # Update cache
            self._cache[cache_key] = template_list
            yield template_list

        except Exception as e:
            logger.error(f"Error retrieving organization templates: {str(e)}")
            raise ValidationException(
                message="Failed to retrieve organization templates",
                error_code="template_003",
                details={"org_id": str(org_id), "error": str(e)}
            )

    @asynccontextmanager
    async def bulk_create_templates(
        self,
        templates_data: List[TemplateCreate]
    ) -> List[TemplateInDB]:
        """
        Create multiple templates in a single operation.

        Args:
            templates_data: List of template creation data

        Returns:
            List[TemplateInDB]: Created templates

        Raises:
            ValidationException: If validation fails
        """
        try:
            # Validate bulk operation size
            if len(templates_data) > MAX_BULK_OPERATIONS:
                raise ValidationException(
                    message=f"Maximum {MAX_BULK_OPERATIONS} templates allowed per operation",
                    error_code="template_004",
                    details={"count": len(templates_data)}
                )

            # Validate all template versions
            for template in templates_data:
                if not semver.VersionInfo.isvalid(template.version):
                    raise ValidationException(
                        message=ERROR_INVALID_VERSION,
                        error_code="template_005",
                        details={"version": template.version}
                    )

            # Create templates using repository
            async with self._repository.bulk_create(
                [t.dict() for t in templates_data]
            ) as created_templates:
                # Clear relevant caches
                for template in created_templates:
                    org_cache_key = f"org_templates:{template.org_id}"
                    self._cache.pop(org_cache_key, None)

                # Convert to schema objects
                template_list = [TemplateInDB.from_orm(t) for t in created_templates]
                yield template_list

        except ValidationException:
            raise
        except Exception as e:
            logger.error(f"Error creating templates in bulk: {str(e)}")
            raise ValidationException(
                message="Failed to create templates",
                error_code="template_006",
                details={"error": str(e)}
            )

    @asynccontextmanager
    async def update_template(
        self,
        template_id: UUID,
        template_data: TemplateUpdate
    ) -> TemplateInDB:
        """
        Update existing template with version control.

        Args:
            template_id: Template UUID
            template_data: Template update data

        Returns:
            TemplateInDB: Updated template

        Raises:
            NotFoundException: If template not found
            VersionConflictException: If version conflict detected
        """
        try:
            # Get existing template
            async with self.get_template(template_id) as template:
                # Validate semantic version if provided
                if template_data.version:
                    if not semver.VersionInfo.isvalid(template_data.version):
                        raise ValidationException(
                            message=ERROR_INVALID_VERSION,
                            error_code="template_007",
                            details={"version": template_data.version}
                        )

                    # Check version conflicts
                    current_version = semver.VersionInfo.parse(template.version)
                    new_version = semver.VersionInfo.parse(template_data.version)
                    if new_version <= current_version:
                        raise VersionConflictException(
                            message=ERROR_VERSION_CONFLICT,
                            error_code="template_008",
                            details={
                                "current_version": str(current_version),
                                "new_version": str(new_version)
                            }
                        )

                # Update template using repository
                async with self._repository.update_content(
                    template_id,
                    template_data.content or template.content,
                    template_data.version or template.version
                ) as updated_template:
                    # Clear caches
                    cache_key = f"template:{template_id}"
                    org_cache_key = f"org_templates:{updated_template.org_id}"
                    self._cache.pop(cache_key, None)
                    self._cache.pop(org_cache_key, None)

                    # Log audit trail
                    logger.info(
                        f"Template {template_id} updated: version {template.version} -> "
                        f"{updated_template.version}"
                    )

                    template_data = TemplateInDB.from_orm(updated_template)
                    yield template_data

        except (NotFoundException, ValidationException, VersionConflictException):
            raise
        except Exception as e:
            logger.error(f"Error updating template {template_id}: {str(e)}")
            raise ValidationException(
                message="Failed to update template",
                error_code="template_009",
                details={"template_id": str(template_id), "error": str(e)}
            )