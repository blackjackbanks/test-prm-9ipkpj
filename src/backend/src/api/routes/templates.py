"""
FastAPI router implementation for template management endpoints in the COREos platform.
Provides secure REST API operations for business process templates with enhanced caching,
rate limiting, and audit logging.

Version: 1.0.0
"""

import logging
from typing import List, Dict, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi_limiter import FastAPILimiter
from cachecontrol import CacheControl
import semver

from services.template_service import TemplateService
from data.schemas.template import TemplateCreate, TemplateUpdate, TemplateInDB
from api.dependencies import get_current_user, PermissionDependency
from utils.exceptions import ValidationException, NotFoundException

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/api/v1/templates",
    tags=["Templates"]
)

# Initialize services
template_service = TemplateService()

# Cache configuration
CACHE_TTL = 300  # 5 minutes

@router.get("/", response_model=List[TemplateInDB])
async def get_templates(
    org_id: UUID,
    category: Optional[str] = None,
    current_user: Dict = Depends(get_current_user),
    request: Request = None,
    response: Response = None,
    _: bool = Depends(PermissionDependency("templates:read"))
) -> List[TemplateInDB]:
    """
    Get all templates for an organization with filtering and caching.

    Args:
        org_id: Organization UUID
        category: Optional category filter
        current_user: Current authenticated user
        request: FastAPI request object
        response: FastAPI response object

    Returns:
        List[TemplateInDB]: List of templates matching criteria
    """
    try:
        # Check rate limit
        await FastAPILimiter.check_rate_limit(request)

        # Verify user has access to organization
        if str(org_id) != str(current_user.get("org_id")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to organization templates"
            )

        # Check cache
        cache_key = f"templates:{org_id}:{category or 'all'}"
        if request.headers.get("cache-control") != "no-cache":
            cached_response = await template_service.get_cached_response(cache_key)
            if cached_response:
                return cached_response

        # Get templates
        async with template_service.get_org_templates(org_id, category) as templates:
            # Set cache headers
            response.headers["Cache-Control"] = f"max-age={CACHE_TTL}"
            
            # Cache response
            await template_service.cache_response(cache_key, templates, CACHE_TTL)
            
            return templates

    except Exception as e:
        logger.error(f"Error retrieving templates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve templates"
        )

@router.get("/{template_id}", response_model=TemplateInDB)
async def get_template(
    template_id: UUID,
    current_user: Dict = Depends(get_current_user),
    request: Request = None,
    response: Response = None,
    _: bool = Depends(PermissionDependency("templates:read"))
) -> TemplateInDB:
    """
    Get specific template by ID with caching.

    Args:
        template_id: Template UUID
        current_user: Current authenticated user
        request: FastAPI request object
        response: FastAPI response object

    Returns:
        TemplateInDB: Template details
    """
    try:
        # Check rate limit
        await FastAPILimiter.check_rate_limit(request)

        # Check cache
        cache_key = f"template:{template_id}"
        if request.headers.get("cache-control") != "no-cache":
            cached_response = await template_service.get_cached_response(cache_key)
            if cached_response:
                return cached_response

        # Get template
        async with template_service.get_template(template_id) as template:
            # Verify user has access to template's organization
            if str(template.org_id) != str(current_user.get("org_id")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to template"
                )

            # Set cache headers
            response.headers["Cache-Control"] = f"max-age={CACHE_TTL}"
            
            # Cache response
            await template_service.cache_response(cache_key, template, CACHE_TTL)
            
            return template

    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error retrieving template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve template"
        )

@router.post("/", response_model=TemplateInDB, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: TemplateCreate,
    current_user: Dict = Depends(get_current_user),
    request: Request = None,
    _: bool = Depends(PermissionDependency("templates:create"))
) -> TemplateInDB:
    """
    Create new template with version validation.

    Args:
        template_data: Template creation data
        current_user: Current authenticated user
        request: FastAPI request object

    Returns:
        TemplateInDB: Created template
    """
    try:
        # Check rate limit
        await FastAPILimiter.check_rate_limit(request)

        # Verify user has access to organization
        if str(template_data.org_id) != str(current_user.get("org_id")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to create template for organization"
            )

        # Validate version format
        if not semver.VersionInfo.isvalid(template_data.version):
            raise ValidationException(
                message="Invalid semantic version format",
                error_code="template_001"
            )

        # Create template
        async with template_service.create_template(template_data) as template:
            # Invalidate related caches
            await template_service.invalidate_org_caches(template_data.org_id)
            
            return template

    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template"
        )

@router.put("/{template_id}", response_model=TemplateInDB)
async def update_template(
    template_id: UUID,
    template_data: TemplateUpdate,
    current_user: Dict = Depends(get_current_user),
    request: Request = None,
    _: bool = Depends(PermissionDependency("templates:update"))
) -> TemplateInDB:
    """
    Update existing template with version conflict detection.

    Args:
        template_id: Template UUID
        template_data: Template update data
        current_user: Current authenticated user
        request: FastAPI request object

    Returns:
        TemplateInDB: Updated template
    """
    try:
        # Check rate limit
        await FastAPILimiter.check_rate_limit(request)

        # Get existing template
        async with template_service.get_template(template_id) as template:
            # Verify user has access to template's organization
            if str(template.org_id) != str(current_user.get("org_id")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to update template"
                )

            # Validate version if provided
            if template_data.version:
                if not semver.VersionInfo.isvalid(template_data.version):
                    raise ValidationException(
                        message="Invalid semantic version format",
                        error_code="template_002"
                    )

                # Check version conflicts
                current_version = semver.VersionInfo.parse(template.version)
                new_version = semver.VersionInfo.parse(template_data.version)
                if new_version <= current_version:
                    raise ValidationException(
                        message="New version must be greater than current version",
                        error_code="template_003"
                    )

            # Update template
            async with template_service.update_template(template_id, template_data) as updated_template:
                # Invalidate related caches
                await template_service.invalidate_template_caches(template_id, template.org_id)
                
                return updated_template

    except (NotFoundException, ValidationException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update template"
        )

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    current_user: Dict = Depends(get_current_user),
    request: Request = None,
    _: bool = Depends(PermissionDependency("templates:delete"))
) -> Dict:
    """
    Delete template with audit logging.

    Args:
        template_id: Template UUID
        current_user: Current authenticated user
        request: FastAPI request object

    Returns:
        Dict: Success message
    """
    try:
        # Check rate limit
        await FastAPILimiter.check_rate_limit(request)

        # Get template for validation
        async with template_service.get_template(template_id) as template:
            # Verify user has access to template's organization
            if str(template.org_id) != str(current_user.get("org_id")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to delete template"
                )

            # Delete template
            async with template_service.delete_template(template_id) as _:
                # Invalidate related caches
                await template_service.invalidate_template_caches(template_id, template.org_id)
                
                return {"message": "Template deleted successfully"}

    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete template"
        )