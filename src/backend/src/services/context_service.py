"""
Service layer implementation for managing business context data and AI-driven insights.
Provides optimized context processing, caching, and resilience patterns.

Version: 1.0.0
"""

from uuid import UUID
from typing import List, Optional, Dict, Any
import asyncio
import logging
from tenacity import retry, stop_after_attempt, wait_exponential
from opentelemetry import trace
from cachetools import TTLCache
from functools import wraps

from data.repositories.context import ContextRepository
from data.models.context import Context
from contextual_engine.processor import ContextProcessor
from utils.exceptions import ValidationException

# Constants for service configuration
DEFAULT_BATCH_SIZE: int = 10
MAX_CONCURRENT_PROCESSES: int = 5
CACHE_TTL: int = 300  # 5 minutes
MAX_RETRIES: int = 3
RETRY_DELAY: float = 0.5

# Initialize tracing
tracer = trace.get_tracer(__name__)

def monitored(func):
    """Decorator for monitoring service operations."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        with tracer.start_as_current_span(func.__name__) as span:
            try:
                result = await func(*args, **kwargs)
                span.set_attribute("success", True)
                return result
            except Exception as e:
                span.set_attribute("success", False)
                span.set_attribute("error", str(e))
                raise
    return wrapper

def cached(ttl: int = CACHE_TTL):
    """Decorator for caching service results."""
    cache = TTLCache(maxsize=1000, ttl=ttl)
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            if key in cache:
                return cache[key]
            result = await func(*args, **kwargs)
            cache[key] = result
            return result
        return wrapper
    return decorator

class ContextService:
    """Enhanced service for managing business context operations."""

    def __init__(
        self,
        repository: ContextRepository,
        processor: ContextProcessor,
        logger: logging.Logger
    ):
        """Initialize context service with dependencies."""
        self._repository = repository
        self._processor = processor
        self._logger = logger
        self._logger.info("Initialized ContextService")

    @monitored
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY)
    )
    @cached()
    async def get_context(self, context_id: UUID) -> Optional[Context]:
        """
        Retrieve context entry by ID with caching and monitoring.

        Args:
            context_id: UUID of the context to retrieve

        Returns:
            Optional[Context]: Context entry if found

        Raises:
            ValidationException: If context retrieval fails
        """
        try:
            async with self._repository.get_by_id(str(context_id)) as context:
                if context:
                    self._logger.debug(f"Retrieved context: {context_id}")
                    return context
                return None
        except Exception as e:
            self._logger.error(f"Error retrieving context {context_id}: {str(e)}")
            raise ValidationException(
                message=f"Failed to retrieve context: {str(e)}",
                error_code="context_001",
                details={"context_id": str(context_id)}
            )

    @monitored
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY)
    )
    @cached()
    async def get_organization_contexts(
        self,
        organization_id: UUID,
        context_type: Optional[str] = None,
        page_size: Optional[int] = None,
        page_number: Optional[int] = None
    ) -> List[Context]:
        """
        Get organization contexts with filtering and pagination.

        Args:
            organization_id: Organization UUID
            context_type: Optional context type filter
            page_size: Optional page size
            page_number: Optional page number

        Returns:
            List[Context]: List of matching contexts
        """
        try:
            async with self._repository.get_by_organization(organization_id) as contexts:
                filtered_contexts = [
                    ctx for ctx in contexts
                    if not context_type or ctx.type == context_type
                ]

                if page_size and page_number:
                    start_idx = (page_number - 1) * page_size
                    end_idx = start_idx + page_size
                    return filtered_contexts[start_idx:end_idx]
                return filtered_contexts

        except Exception as e:
            self._logger.error(f"Error retrieving organization contexts: {str(e)}")
            raise ValidationException(
                message=f"Failed to retrieve organization contexts: {str(e)}",
                error_code="context_002",
                details={"organization_id": str(organization_id)}
            )

    @monitored
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY)
    )
    async def process_context(
        self,
        organization_id: UUID,
        context_data: Dict[str, Any],
        processing_params: Optional[Dict] = None
    ) -> Context:
        """
        Process and store new context data with resilience patterns.

        Args:
            organization_id: Organization UUID
            context_data: Raw context data to process
            processing_params: Optional processing parameters

        Returns:
            Context: Processed and stored context
        """
        try:
            # Process context using AI engine
            processed_result = await self._processor.process_context({
                "organization_id": str(organization_id),
                "context_data": context_data,
                "processing_params": processing_params or {}
            })

            # Create new context entry
            context_entry = Context(
                organization_id=organization_id,
                type=processed_result["insights"]["type"],
                content=processed_result["insights"]
            )

            # Store in repository
            async with self._repository.create(context_entry.__dict__) as stored_context:
                self._logger.info(f"Created new context for organization: {organization_id}")
                return stored_context

        except Exception as e:
            self._logger.error(f"Error processing context: {str(e)}")
            raise ValidationException(
                message=f"Failed to process context: {str(e)}",
                error_code="context_003",
                details={"organization_id": str(organization_id)}
            )

    @monitored
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY)
    )
    async def batch_process_contexts(
        self,
        context_requests: List[Dict],
        batch_config: Optional[Dict] = None
    ) -> List[Context]:
        """
        Optimized batch processing with parallel execution.

        Args:
            context_requests: List of context processing requests
            batch_config: Optional batch processing configuration

        Returns:
            List[Context]: List of processed contexts
        """
        try:
            # Validate batch size
            if len(context_requests) > DEFAULT_BATCH_SIZE:
                raise ValueError(f"Batch size exceeds maximum: {len(context_requests)}")

            # Process in parallel with semaphore
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_PROCESSES)
            async with semaphore:
                tasks = [
                    self.process_context(
                        UUID(req["organization_id"]),
                        req["context_data"],
                        req.get("processing_params")
                    )
                    for req in context_requests
                ]
                return await asyncio.gather(*tasks)

        except Exception as e:
            self._logger.error(f"Error in batch processing: {str(e)}")
            raise ValidationException(
                message=f"Failed to process batch: {str(e)}",
                error_code="context_004",
                details={"batch_size": len(context_requests)}
            )

    @monitored
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY)
    )
    @cached()
    async def search_contexts(
        self,
        search_criteria: Dict[str, Any],
        organization_id: Optional[UUID] = None,
        search_options: Optional[Dict] = None
    ) -> List[Context]:
        """
        Enhanced search with advanced filtering and caching.

        Args:
            search_criteria: Search criteria for content fields
            organization_id: Optional organization filter
            search_options: Optional search configuration

        Returns:
            List[Context]: Matching contexts with metadata
        """
        try:
            async with self._repository.search_content(
                search_criteria,
                organization_id,
                search_options and search_options.get("use_cache", True)
            ) as contexts:
                return contexts

        except Exception as e:
            self._logger.error(f"Error searching contexts: {str(e)}")
            raise ValidationException(
                message=f"Failed to search contexts: {str(e)}",
                error_code="context_005",
                details={
                    "criteria": search_criteria,
                    "organization_id": str(organization_id) if organization_id else None
                }
            )