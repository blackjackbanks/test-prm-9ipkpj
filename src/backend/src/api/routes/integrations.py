"""
FastAPI router implementation for managing external service integrations in the COREos platform.
Provides endpoints for CRUD operations, configuration, synchronization, and health monitoring.

Version: 1.0.0
"""

from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import JSONResponse
from fastapi_limiter import RateLimiter
from cachetools import TTLCache
from circuitbreaker import circuit

from services.integration_service import IntegrationService
from utils.constants import (
    IntegrationTypes,
    HTTPStatusCodes,
    ErrorCodes,
    CACHE_TTL_SECONDS
)
from utils.exceptions import (
    IntegrationException,
    ValidationException,
    NotFoundException
)
from utils.helpers import sanitize_string

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/api/v1/integrations",
    tags=["integrations"]
)

# Initialize cache with TTL
integration_cache = TTLCache(maxsize=1000, ttl=CACHE_TTL_SECONDS)

# Rate limiting configuration
rate_limiter = RateLimiter(
    key_func=lambda: "integration_operations",
    max_requests=100,
    time_window=60
)

# Circuit breaker configuration
@circuit(
    failure_threshold=5,
    recovery_timeout=60,
    name="integration_operations"
)
async def protected_operation(func, *args, **kwargs):
    return await func(*args, **kwargs)

@router.get("/")
async def get_integrations(
    current_user: Dict = Depends(get_current_user),
    integration_service: IntegrationService = Depends(),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    integration_type: Optional[str] = Query(None, description="Filter by integration type"),
    sort_by: Optional[str] = Query("created_at", description="Sort field")
) -> Dict:
    """
    Retrieve paginated list of integrations with filtering and sorting.

    Args:
        current_user: Authenticated user information
        integration_service: Integration service instance
        page: Page number for pagination
        page_size: Number of items per page
        integration_type: Optional integration type filter
        sort_by: Field to sort results by

    Returns:
        Dict containing paginated integration list and metadata
    """
    try:
        # Generate cache key
        cache_key = f"integrations:{current_user['organization_id']}:{page}:{page_size}:{integration_type}:{sort_by}"
        
        # Check cache
        if cache_key in integration_cache:
            return integration_cache[cache_key]

        # Validate integration type if provided
        if integration_type and integration_type not in IntegrationTypes.__members__:
            raise ValidationException(
                message="Invalid integration type",
                error_code="int_001",
                details={"type": integration_type}
            )

        # Get integrations with protected operation
        integrations = await protected_operation(
            integration_service.async_get_organization_integrations,
            organization_id=current_user["organization_id"],
            page=page,
            page_size=page_size,
            filter_type=integration_type,
            sort_by=sort_by
        )

        # Prepare response
        response = {
            "items": integrations["items"],
            "total": integrations["total"],
            "page": page,
            "page_size": page_size,
            "total_pages": (integrations["total"] + page_size - 1) // page_size
        }

        # Update cache
        integration_cache[cache_key] = response
        return response

    except ValidationException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.BAD_REQUEST.value,
            detail=e.to_dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.post("/bulk")
@rate_limiter.limit()
async def bulk_create_integrations(
    integration_data: List[Dict],
    current_user: Dict = Depends(get_current_user),
    integration_service: IntegrationService = Depends()
) -> Dict:
    """
    Configure multiple integrations in bulk with validation and error handling.

    Args:
        integration_data: List of integration configurations
        current_user: Authenticated user information
        integration_service: Integration service instance

    Returns:
        Dict containing created integrations and operation status
    """
    try:
        # Validate bulk data
        if not integration_data:
            raise ValidationException(
                message="No integration data provided",
                error_code="int_002",
                details={}
            )

        # Process bulk creation with protected operation
        results = await protected_operation(
            integration_service.async_bulk_configure,
            organization_id=current_user["organization_id"],
            configurations=integration_data
        )

        # Clear relevant cache entries
        cache_key_prefix = f"integrations:{current_user['organization_id']}"
        integration_cache.clear()

        return {
            "status": "success",
            "created": len(results["successful"]),
            "failed": len(results["failed"]),
            "details": results
        }

    except ValidationException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.BAD_REQUEST.value,
            detail=e.to_dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.get("/{integration_id}/health")
async def get_integration_health(
    integration_id: UUID = Path(..., description="Integration identifier"),
    current_user: Dict = Depends(get_current_user),
    integration_service: IntegrationService = Depends()
) -> Dict:
    """
    Get health status and metrics for a specific integration.

    Args:
        integration_id: Integration identifier
        current_user: Authenticated user information
        integration_service: Integration service instance

    Returns:
        Dict containing health status and metrics
    """
    try:
        # Generate cache key
        cache_key = f"integration_health:{integration_id}"
        
        # Check cache
        if cache_key in integration_cache:
            return integration_cache[cache_key]

        # Get health status with protected operation
        health_status = await protected_operation(
            integration_service.async_get_health_status,
            integration_id=str(integration_id),
            organization_id=current_user["organization_id"]
        )

        # Update cache with short TTL for health data
        integration_cache[cache_key] = health_status
        return health_status

    except NotFoundException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.NOT_FOUND.value,
            detail=e.to_dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.post("/{integration_id}/sync")
@rate_limiter.limit()
async def trigger_integration_sync(
    integration_id: UUID = Path(..., description="Integration identifier"),
    current_user: Dict = Depends(get_current_user),
    integration_service: IntegrationService = Depends()
) -> Dict:
    """
    Trigger manual synchronization for an integration.

    Args:
        integration_id: Integration identifier
        current_user: Authenticated user information
        integration_service: Integration service instance

    Returns:
        Dict containing sync operation status
    """
    try:
        # Trigger sync with protected operation
        sync_status = await protected_operation(
            integration_service.async_start_sync,
            integration_id=str(integration_id),
            organization_id=current_user["organization_id"]
        )

        # Clear health status cache
        cache_key = f"integration_health:{integration_id}"
        integration_cache.pop(cache_key, None)

        return {
            "status": "initiated",
            "sync_id": sync_status["sync_id"],
            "started_at": datetime.utcnow().isoformat()
        }

    except NotFoundException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.NOT_FOUND.value,
            detail=e.to_dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )