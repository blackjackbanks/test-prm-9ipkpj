"""
FastAPI router implementation for context-related endpoints handling business context data,
AI processing, and insights generation in the COREos platform.

Version: 1.0.0
"""

from typing import Dict, List, Optional
from uuid import UUID
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from prometheus_client import Counter, Histogram

from services.context_service import ContextService
from utils.cache import RedisCache
from data.models.context import Context
from utils.exceptions import ValidationException, NotFoundException
from utils.constants import HTTPStatusCodes

# Initialize router
router = APIRouter(prefix="/api/v1/context", tags=["context"])

# Initialize services
context_service = ContextService()
context_cache = RedisCache()

# Prometheus metrics
CONTEXT_OPERATIONS = Counter(
    'context_operations_total',
    'Total context operations',
    ['operation_type']
)
CONTEXT_PROCESSING_TIME = Histogram(
    'context_processing_seconds',
    'Time spent processing context'
)

# Configure logging
logger = logging.getLogger(__name__)

@router.get("/{context_id}", response_model=Dict)
async def get_context_by_id(
    context_id: UUID,
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """
    Retrieve a specific context entry by ID with caching and monitoring.

    Args:
        context_id: UUID of the context to retrieve
        current_user: Current authenticated user

    Returns:
        Dict: Context entry details

    Raises:
        HTTPException: If context not found or access denied
    """
    try:
        # Check cache first
        cache_key = f"context:{str(context_id)}"
        cached_context = await context_cache.get_cache(cache_key)
        if cached_context:
            CONTEXT_OPERATIONS.labels(operation_type="get_cached").inc()
            return cached_context

        # Get context from service
        async with CONTEXT_PROCESSING_TIME.time():
            context = await context_service.get_context(context_id)

        if not context:
            raise NotFoundException(
                message="Context not found",
                error_code="context_001",
                details={"context_id": str(context_id)}
            )

        # Cache the result
        await context_cache.set_cache(cache_key, context)
        CONTEXT_OPERATIONS.labels(operation_type="get").inc()

        return context

    except Exception as e:
        logger.error(f"Error retrieving context {context_id}: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.get("", response_model=List[Dict])
async def get_organization_contexts(
    organization_id: UUID,
    context_type: Optional[str] = None,
    page: Optional[int] = Query(1, ge=1),
    size: Optional[int] = Query(10, ge=1, le=100),
    current_user: Dict = Depends(get_current_user)
) -> List[Dict]:
    """
    Get organization contexts with filtering and pagination.

    Args:
        organization_id: Organization UUID
        context_type: Optional context type filter
        page: Page number for pagination
        size: Page size for pagination
        current_user: Current authenticated user

    Returns:
        List[Dict]: List of matching contexts
    """
    try:
        async with CONTEXT_PROCESSING_TIME.time():
            contexts = await context_service.get_organization_contexts(
                organization_id,
                context_type,
                size,
                page
            )

        CONTEXT_OPERATIONS.labels(operation_type="list").inc()
        return contexts

    except Exception as e:
        logger.error(f"Error listing contexts: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.post("", response_model=Dict)
async def create_context(
    context_data: Dict,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """
    Create new context entry with AI processing.

    Args:
        context_data: Context data to process
        background_tasks: FastAPI background tasks
        current_user: Current authenticated user

    Returns:
        Dict: Created context entry
    """
    try:
        async with CONTEXT_PROCESSING_TIME.time():
            context = await context_service.process_context(
                current_user["organization_id"],
                context_data
            )

        # Schedule async processing
        background_tasks.add_task(
            context_service.batch_process_contexts,
            [{"organization_id": current_user["organization_id"], "context_data": context_data}]
        )

        CONTEXT_OPERATIONS.labels(operation_type="create").inc()
        return context

    except ValidationException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.BAD_REQUEST.value,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating context: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.put("/{context_id}", response_model=Dict)
async def update_context(
    context_id: UUID,
    update_data: Dict,
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """
    Update existing context entry.

    Args:
        context_id: UUID of context to update
        update_data: Update data
        current_user: Current authenticated user

    Returns:
        Dict: Updated context entry
    """
    try:
        async with CONTEXT_PROCESSING_TIME.time():
            context = await context_service.update_context(
                context_id,
                update_data
            )

        # Invalidate cache
        cache_key = f"context:{str(context_id)}"
        await context_cache.delete_cache(cache_key)

        CONTEXT_OPERATIONS.labels(operation_type="update").inc()
        return context

    except NotFoundException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.NOT_FOUND.value,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating context {context_id}: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.delete("/{context_id}")
async def delete_context(
    context_id: UUID,
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """
    Delete context entry (soft delete).

    Args:
        context_id: UUID of context to delete
        current_user: Current authenticated user

    Returns:
        Dict: Deletion status
    """
    try:
        async with CONTEXT_PROCESSING_TIME.time():
            await context_service.delete_context(context_id)

        # Invalidate cache
        cache_key = f"context:{str(context_id)}"
        await context_cache.delete_cache(cache_key)

        CONTEXT_OPERATIONS.labels(operation_type="delete").inc()
        return {"status": "success", "message": "Context deleted successfully"}

    except NotFoundException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.NOT_FOUND.value,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting context {context_id}: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )

@router.post("/search", response_model=List[Dict])
async def search_contexts(
    search_criteria: Dict,
    current_user: Dict = Depends(get_current_user)
) -> List[Dict]:
    """
    Search context entries with advanced filtering.

    Args:
        search_criteria: Search criteria for filtering contexts
        current_user: Current authenticated user

    Returns:
        List[Dict]: List of matching contexts
    """
    try:
        async with CONTEXT_PROCESSING_TIME.time():
            contexts = await context_service.search_contexts(
                search_criteria,
                current_user["organization_id"]
            )

        CONTEXT_OPERATIONS.labels(operation_type="search").inc()
        return contexts

    except ValidationException as e:
        raise HTTPException(
            status_code=HTTPStatusCodes.BAD_REQUEST.value,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error searching contexts: {str(e)}")
        raise HTTPException(
            status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
            detail=str(e)
        )