"""
Enhanced service layer implementation for managing external service integrations in the COREos platform.
Provides robust integration lifecycle management with advanced reliability features.

Version: 1.0.0
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from fastapi import Depends
from tenacity import (
    retry,
    stop_after_attempt,
    wait_fixed,
    RetryError
)
from prometheus_client import Counter, Histogram
from circuit_breaker import CircuitBreaker

from data.repositories.integration import IntegrationRepository
from integration_hub.sync import IntegrationSyncManager
from utils.constants import (
    DEFAULT_SYNC_INTERVAL,
    MAX_RETRY_ATTEMPTS,
    RETRY_DELAY_SECONDS,
    CIRCUIT_BREAKER_THRESHOLD,
    CONNECTION_POOL_SIZE,
    CACHE_TTL_SECONDS,
    IntegrationTypes,
    ErrorCodes
)
from utils.exceptions import (
    IntegrationException,
    ValidationException,
    NotFoundException
)

# Configure logging
logger = logging.getLogger(__name__)

# Prometheus metrics
integration_operations = Counter(
    'integration_operations_total',
    'Total number of integration operations',
    ['operation', 'status']
)
integration_latency = Histogram(
    'integration_operation_latency_seconds',
    'Integration operation latency in seconds',
    ['operation']
)

class IntegrationService:
    """
    Enhanced service class for managing integration operations with reliability features,
    connection pooling, and comprehensive monitoring.
    """

    def __init__(
        self,
        repository: IntegrationRepository,
        sync_manager: IntegrationSyncManager,
        circuit_breaker: Optional[CircuitBreaker] = None
    ):
        """
        Initialize integration service with enhanced dependencies.

        Args:
            repository: Integration repository instance
            sync_manager: Sync manager instance
            circuit_breaker: Optional circuit breaker instance
        """
        self._repository = repository
        self._sync_manager = sync_manager
        self._active_integrations: Dict[str, Any] = {}
        
        # Initialize circuit breaker if not provided
        self._circuit_breaker = circuit_breaker or CircuitBreaker(
            failure_threshold=CIRCUIT_BREAKER_THRESHOLD,
            recovery_timeout=30,
            name="integration_service_breaker"
        )
        
        # Initialize connection pool
        self._connection_pool = {
            'size': CONNECTION_POOL_SIZE,
            'active': 0,
            'available': CONNECTION_POOL_SIZE
        }
        
        # Initialize cache
        self._cache: Dict[str, Any] = {}
        
        logger.info("Integration service initialized with enhanced features")

    @retry(
        stop=stop_after_attempt(MAX_RETRY_ATTEMPTS),
        wait=wait_fixed(RETRY_DELAY_SECONDS)
    )
    async def async_get_organization_integrations(
        self,
        organization_id: str
    ) -> List[Dict[str, Any]]:
        """
        Retrieve all integrations for an organization with caching and monitoring.

        Args:
            organization_id: Organization identifier

        Returns:
            List of organization's integrations with health status

        Raises:
            NotFoundException: If no integrations found
            IntegrationException: If retrieval fails
        """
        operation = 'get_organization_integrations'
        timer = integration_latency.labels(operation).time()

        try:
            # Check cache first
            cache_key = f"org_integrations:{organization_id}"
            if cache_key in self._cache:
                integration_operations.labels(
                    operation=operation,
                    status='cache_hit'
                ).inc()
                return self._cache[cache_key]

            # Get integrations with circuit breaker protection
            async with self._circuit_breaker:
                async with self._repository.get_by_organization(organization_id) as integrations:
                    if not integrations:
                        raise NotFoundException(
                            message="No integrations found for organization",
                            error_code="int_001",
                            details={"organization_id": organization_id}
                        )

                    # Enhance with health status
                    enhanced_integrations = []
                    for integration in integrations:
                        health_status = await self._get_integration_health(integration.id)
                        enhanced_integration = {
                            **integration.dict(),
                            'health_status': health_status
                        }
                        enhanced_integrations.append(enhanced_integration)

                    # Update cache
                    self._cache[cache_key] = enhanced_integrations
                    integration_operations.labels(
                        operation=operation,
                        status='success'
                    ).inc()
                    
                    return enhanced_integrations

        except RetryError as e:
            logger.error(f"Max retries exceeded for {operation}: {str(e)}")
            integration_operations.labels(
                operation=operation,
                status='retry_failed'
            ).inc()
            raise IntegrationException(
                message="Failed to retrieve integrations after retries",
                error_code="int_002",
                details={"error": str(e)}
            )

        except Exception as e:
            logger.error(f"Error in {operation}: {str(e)}")
            integration_operations.labels(
                operation=operation,
                status='error'
            ).inc()
            raise IntegrationException(
                message="Failed to retrieve integrations",
                error_code="int_003",
                details={"error": str(e)}
            )

        finally:
            timer.observe()

    @retry(
        stop=stop_after_attempt(MAX_RETRY_ATTEMPTS),
        wait=wait_fixed(RETRY_DELAY_SECONDS)
    )
    async def async_configure_integration(
        self,
        organization_id: str,
        integration_type: IntegrationTypes,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Configure a new integration with enhanced validation and monitoring.

        Args:
            organization_id: Organization identifier
            integration_type: Type of integration
            config: Integration configuration

        Returns:
            Newly configured integration with health check

        Raises:
            ValidationException: If configuration is invalid
            IntegrationException: If configuration fails
        """
        operation = 'configure_integration'
        timer = integration_latency.labels(operation).time()

        try:
            # Validate configuration
            if not self._validate_integration_config(integration_type, config):
                raise ValidationException(
                    message="Invalid integration configuration",
                    error_code="int_004",
                    details={"type": integration_type.value}
                )

            # Configure integration with circuit breaker protection
            async with self._circuit_breaker:
                # Initialize integration
                integration_config = await self._sync_manager.async_validate_config(
                    integration_type,
                    config
                )

                # Create integration record
                async with self._repository.create({
                    'organization_id': organization_id,
                    'type': integration_type.value,
                    'config': integration_config,
                    'active': True
                }) as integration:
                    
                    # Schedule initial sync
                    sync_config = await self._sync_manager.async_schedule_sync(
                        integration.id,
                        integration_type.value,
                        DEFAULT_SYNC_INTERVAL
                    )

                    # Clear organization cache
                    cache_key = f"org_integrations:{organization_id}"
                    self._cache.pop(cache_key, None)

                    integration_operations.labels(
                        operation=operation,
                        status='success'
                    ).inc()

                    return {
                        **integration.dict(),
                        'sync_status': sync_config
                    }

        except RetryError as e:
            logger.error(f"Max retries exceeded for {operation}: {str(e)}")
            integration_operations.labels(
                operation=operation,
                status='retry_failed'
            ).inc()
            raise IntegrationException(
                message="Failed to configure integration after retries",
                error_code="int_005",
                details={"error": str(e)}
            )

        except Exception as e:
            logger.error(f"Error in {operation}: {str(e)}")
            integration_operations.labels(
                operation=operation,
                status='error'
            ).inc()
            raise IntegrationException(
                message="Failed to configure integration",
                error_code="int_006",
                details={"error": str(e)}
            )

        finally:
            timer.observe()

    async def _get_integration_health(self, integration_id: str) -> Dict[str, Any]:
        """Get integration health status with connection check."""
        try:
            status = await self._sync_manager.async_get_sync_status(integration_id)
            return {
                'status': 'healthy' if status.get('active', False) else 'unhealthy',
                'last_check': datetime.utcnow().isoformat(),
                'details': status
            }
        except Exception as e:
            logger.error(f"Health check failed for integration {integration_id}: {str(e)}")
            return {
                'status': 'unknown',
                'last_check': datetime.utcnow().isoformat(),
                'error': str(e)
            }

    def _validate_integration_config(
        self,
        integration_type: IntegrationTypes,
        config: Dict[str, Any]
    ) -> bool:
        """
        Validate integration configuration against schema.
        
        Args:
            integration_type: Type of integration
            config: Configuration to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        try:
            # Validate required fields
            required_fields = {
                IntegrationTypes.CRM: ['provider', 'credentials'],
                IntegrationTypes.DOCUMENT: ['provider', 'access_token'],
                IntegrationTypes.ANALYTICS: ['provider', 'api_key']
            }

            fields = required_fields.get(integration_type, [])
            return all(field in config for field in fields)

        except Exception as e:
            logger.error(f"Configuration validation failed: {str(e)}")
            return False