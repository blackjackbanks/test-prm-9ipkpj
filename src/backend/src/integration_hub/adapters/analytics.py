"""
Analytics platform adapter implementation providing standardized interfaces for tracking events
and metrics across different analytics providers like Mixpanel.

Version: 1.0.0
"""

import abc
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

import mixpanel  # v4.10.0
import aiohttp  # v3.8.5
from tenacity import (  # v8.2.2
    retry,
    stop_after_attempt,
    wait_fixed,
    retry_if_exception_type
)

from integration_hub.config import IntegrationConfig

# Constants for adapter configuration
BATCH_SIZE: int = 50
MAX_RETRIES: int = 3
RETRY_DELAY: float = 1.0
CONNECTION_TIMEOUT: float = 5.0
MAX_POOL_SIZE: int = 100

# Configure logging
logger = logging.getLogger(__name__)

class AnalyticsAdapter(abc.ABC):
    """
    Abstract base class defining interface for analytics platform adapters with async support.
    Implements enterprise-grade features including retry logic, connection pooling, and metrics.
    """

    def __init__(self, config: IntegrationConfig, pool_config: Optional[Dict[str, Any]] = None):
        """
        Initialize analytics adapter with configuration and connection pool.

        Args:
            config: Integration configuration instance
            pool_config: Optional connection pool configuration
        """
        self._config = config.validate_config()
        self._logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # Initialize connection pool
        self._pool_config = pool_config or {
            "limit": MAX_POOL_SIZE,
            "timeout": CONNECTION_TIMEOUT
        }
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=CONNECTION_TIMEOUT),
            connector=aiohttp.TCPConnector(**self._pool_config)
        )
        
        # Initialize metrics tracking
        self._metrics = {
            "events_processed": 0,
            "batch_operations": 0,
            "errors": 0,
            "retries": 0
        }

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        await self._session.close()

    @abc.abstractmethod
    async def track_event(
        self,
        event_name: str,
        properties: Dict[str, Any],
        distinct_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Track a single analytics event with retry support.

        Args:
            event_name: Name of the event to track
            properties: Event properties/data
            distinct_id: Unique identifier for the user/entity
            options: Optional tracking configuration

        Returns:
            Dict containing tracking response and metadata
        """
        pass

    @abc.abstractmethod
    async def batch_track(
        self,
        events: List[Dict[str, Any]],
        batch_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Track multiple analytics events in optimized batches.

        Args:
            events: List of events to track
            batch_config: Optional batch processing configuration

        Returns:
            Dict containing batch tracking results and metadata
        """
        pass

class MixpanelAdapter(AnalyticsAdapter):
    """
    Mixpanel-specific implementation of analytics adapter with enhanced features.
    Implements production-ready tracking with batching, retries, and monitoring.
    """

    def __init__(self, config: IntegrationConfig, client_options: Optional[Dict[str, Any]] = None):
        """
        Initialize Mixpanel adapter with API credentials and configuration.

        Args:
            config: Integration configuration with Mixpanel credentials
            client_options: Optional Mixpanel client configuration
        """
        super().__init__(config)
        
        # Initialize Mixpanel client
        credentials = config.get_connection_params()
        self._client = mixpanel.Mixpanel(
            token=credentials["token"],
            api_key=credentials.get("api_key"),
            **(client_options or {})
        )
        
        # Initialize performance metrics
        self._metrics.update({
            "mixpanel_api_calls": 0,
            "batch_size_avg": 0.0,
            "response_time_avg": 0.0
        })

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_fixed(RETRY_DELAY),
        retry=retry_if_exception_type((aiohttp.ClientError, mixpanel.MixpanelException))
    )
    async def track_event(
        self,
        event_name: str,
        properties: Dict[str, Any],
        distinct_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Track a single event in Mixpanel with enhanced error handling.

        Args:
            event_name: Name of the event to track
            properties: Event properties/data
            distinct_id: Unique identifier for the user/entity
            options: Optional tracking configuration

        Returns:
            Dict containing tracking response and metadata
        """
        start_time = datetime.utcnow()
        
        try:
            # Validate and sanitize input
            if not event_name or not distinct_id:
                raise ValueError("Event name and distinct_id are required")

            # Prepare event data
            event_data = {
                "event": event_name,
                "properties": {
                    "distinct_id": distinct_id,
                    "time": int(start_time.timestamp()),
                    **properties
                }
            }
            
            if options:
                event_data["properties"].update(options)

            # Track event through Mixpanel client
            await self._client.track(
                distinct_id=distinct_id,
                event_name=event_name,
                properties=event_data["properties"]
            )

            # Update metrics
            self._metrics["events_processed"] += 1
            self._metrics["mixpanel_api_calls"] += 1
            
            end_time = datetime.utcnow()
            response_time = (end_time - start_time).total_seconds()
            self._metrics["response_time_avg"] = (
                (self._metrics["response_time_avg"] * (self._metrics["events_processed"] - 1) +
                 response_time) / self._metrics["events_processed"]
            )

            return {
                "success": True,
                "event_id": event_data["properties"].get("time"),
                "timestamp": start_time.isoformat(),
                "response_time": response_time
            }

        except Exception as e:
            self._metrics["errors"] += 1
            self._logger.error(f"Error tracking event {event_name}: {str(e)}", exc_info=True)
            raise

    async def batch_track(
        self,
        events: List[Dict[str, Any]],
        batch_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Track multiple events in Mixpanel using optimized batching.

        Args:
            events: List of events to track
            batch_config: Optional batch processing configuration

        Returns:
            Dict containing batch results and metadata
        """
        start_time = datetime.utcnow()
        results = {
            "success": 0,
            "failed": 0,
            "total": len(events),
            "batches": 0,
            "errors": []
        }

        try:
            # Validate input
            if not events:
                return results

            # Configure batch processing
            batch_size = batch_config.get("batch_size", BATCH_SIZE)
            
            # Process events in batches
            for i in range(0, len(events), batch_size):
                batch = events[i:i + batch_size]
                try:
                    # Process batch through Mixpanel's batch endpoint
                    await self._client.track_batch(
                        [
                            {
                                "event": event["event_name"],
                                "properties": {
                                    "distinct_id": event["distinct_id"],
                                    "time": int(datetime.utcnow().timestamp()),
                                    **event["properties"]
                                }
                            }
                            for event in batch
                        ]
                    )
                    
                    results["success"] += len(batch)
                    results["batches"] += 1
                    
                except Exception as e:
                    results["failed"] += len(batch)
                    results["errors"].append(str(e))
                    self._logger.error(f"Error processing batch: {str(e)}", exc_info=True)

            # Update metrics
            self._metrics["batch_operations"] += 1
            self._metrics["events_processed"] += results["success"]
            self._metrics["batch_size_avg"] = (
                (self._metrics["batch_size_avg"] * (self._metrics["batch_operations"] - 1) +
                 len(events)) / self._metrics["batch_operations"]
            )

            end_time = datetime.utcnow()
            results["duration"] = (end_time - start_time).total_seconds()
            
            return results

        except Exception as e:
            self._metrics["errors"] += 1
            self._logger.error(f"Error in batch tracking: {str(e)}", exc_info=True)
            raise