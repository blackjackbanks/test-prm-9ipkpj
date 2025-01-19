"""
Integration Hub initialization module providing a unified interface for managing external service integrations.
Implements comprehensive logging, monitoring, and security validation for CRM, document storage, and analytics platforms.

Version: 1.0.0
"""

import logging
from typing import Dict, Any, List, Optional

from opentelemetry import trace  # v1.20.0
from opentelemetry.trace import Status, StatusCode

from integration_hub.client import IntegrationClient
from integration_hub.sync import IntegrationSyncManager
from utils.constants import IntegrationTypes

# Package version
VERSION: str = '1.0.0'

# Supported integration types
SUPPORTED_INTEGRATION_TYPES: List[str] = [
    IntegrationTypes.CRM.value,
    IntegrationTypes.DOCUMENT.value,
    IntegrationTypes.ANALYTICS.value
]

# Configure package-level logging
logger = logging.getLogger(__name__)

# Initialize tracer
tracer = trace.get_tracer(__name__)

def initialize_logging(log_level: int = logging.INFO) -> None:
    """
    Configure package-level logging with appropriate handlers and formatters.
    
    Args:
        log_level: Logging level (default: logging.INFO)
    """
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    
    # Configure file handler for persistent logs
    file_handler = logging.FileHandler('integration_hub.log')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(log_level)
    
    # Set up logger
    logger.setLevel(log_level)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    # Initialize OpenTelemetry integration
    logger.info("Integration Hub logging initialized")

def validate_integration_security(integration_type: str, config: Dict[str, Any]) -> bool:
    """
    Validate security requirements for integration initialization.
    
    Args:
        integration_type: Type of integration (crm, document, analytics)
        config: Integration configuration dictionary
        
    Returns:
        bool: True if security requirements are met
    """
    with tracer.start_as_current_span("validate_integration_security") as span:
        span.set_attribute("integration_type", integration_type)
        
        try:
            # Validate integration type
            if integration_type not in SUPPORTED_INTEGRATION_TYPES:
                logger.error(f"Unsupported integration type: {integration_type}")
                span.set_status(Status(StatusCode.ERROR))
                return False
            
            # Validate SSL/TLS requirements
            if not config.get('ssl_enabled', False):
                logger.error("SSL/TLS is required for secure communication")
                span.set_status(Status(StatusCode.ERROR))
                return False
            
            # Check credential encryption
            credentials = config.get('credentials', {})
            if not credentials or not all(
                isinstance(v, str) and v.startswith('encrypted:')
                for v in credentials.values()
            ):
                logger.error("Credentials must be encrypted")
                span.set_status(Status(StatusCode.ERROR))
                return False
            
            # Verify access permissions
            if not config.get('permissions', {}):
                logger.error("Access permissions not specified")
                span.set_status(Status(StatusCode.ERROR))
                return False
            
            # Validate rate limiting settings
            rate_limits = config.get('rate_limits', {})
            if not rate_limits or not all(
                isinstance(v, int) and v > 0
                for v in rate_limits.values()
            ):
                logger.error("Invalid rate limiting configuration")
                span.set_status(Status(StatusCode.ERROR))
                return False
            
            logger.info(f"Security validation passed for {integration_type} integration")
            span.set_status(Status(StatusCode.OK))
            return True
            
        except Exception as e:
            logger.error(f"Security validation error: {str(e)}")
            span.set_status(Status(StatusCode.ERROR))
            span.record_exception(e)
            return False

# Export public interface
__all__ = [
    'VERSION',
    'SUPPORTED_INTEGRATION_TYPES',
    'IntegrationClient',
    'IntegrationSyncManager',
    'initialize_logging',
    'validate_integration_security'
]