"""
Integration adapters initialization module providing a unified interface for accessing
different integration adapters. Implements a centralized registry with comprehensive
type validation, error handling, and logging.

Version: 1.0.0
"""

import logging
from typing import Dict, Type, Any, Optional

# Analytics adapters
from integration_hub.adapters.analytics import (
    AnalyticsAdapter,
    MixpanelAdapter,
)

# CRM adapters
from integration_hub.adapters.crm import (
    BaseCRMAdapter,
    SalesforceCRMAdapter,
)

# Document storage adapters
from integration_hub.adapters.documents import (
    BaseDocumentAdapter,
    GoogleDriveAdapter,
    DropboxAdapter,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Centralized adapter registry mapping integration types and providers
# to their concrete implementations
ADAPTER_REGISTRY: Dict[str, Dict[str, str]] = {
    'analytics': {
        'mixpanel': 'MixpanelAdapter',
    },
    'crm': {
        'salesforce': 'SalesforceCRMAdapter',
    },
    'documents': {
        'google_drive': 'GoogleDriveAdapter',
        'dropbox': 'DropboxAdapter'
    }
}

# Mapping of adapter class implementations
ADAPTER_IMPLEMENTATIONS = {
    # Analytics implementations
    'MixpanelAdapter': MixpanelAdapter,
    
    # CRM implementations
    'SalesforceCRMAdapter': SalesforceCRMAdapter,
    
    # Document storage implementations
    'GoogleDriveAdapter': GoogleDriveAdapter,
    'DropboxAdapter': DropboxAdapter
}

# Base adapter type mapping
BASE_ADAPTER_TYPES = {
    'analytics': AnalyticsAdapter,
    'crm': BaseCRMAdapter,
    'documents': BaseDocumentAdapter
}

def get_adapter_class(integration_type: str, provider: str) -> Optional[Type[Any]]:
    """
    Retrieve the appropriate adapter class for a given integration type and provider.
    
    Args:
        integration_type: Type of integration (analytics, crm, documents)
        provider: Specific provider name (mixpanel, salesforce, etc.)
        
    Returns:
        Type[Any]: Adapter class implementation or None if not found
        
    Raises:
        ValueError: If integration type or provider is invalid
    """
    try:
        # Validate integration type
        if integration_type not in ADAPTER_REGISTRY:
            raise ValueError(f"Invalid integration type: {integration_type}")
            
        # Get provider mapping for integration type
        provider_mapping = ADAPTER_REGISTRY[integration_type]
        
        # Validate provider
        if provider not in provider_mapping:
            raise ValueError(
                f"Invalid provider '{provider}' for integration type '{integration_type}'"
            )
            
        # Get adapter class name
        adapter_class_name = provider_mapping[provider]
        
        # Return concrete implementation
        adapter_class = ADAPTER_IMPLEMENTATIONS.get(adapter_class_name)
        if not adapter_class:
            raise ValueError(f"Implementation not found for adapter: {adapter_class_name}")
            
        logger.info(
            f"Retrieved adapter class {adapter_class.__name__} for "
            f"{integration_type} integration with {provider}"
        )
        return adapter_class
        
    except Exception as e:
        logger.error(
            f"Error retrieving adapter class for {integration_type}/{provider}: {str(e)}"
        )
        raise

def validate_adapter_implementation(adapter_class: Type[Any], integration_type: str) -> bool:
    """
    Validate that an adapter class properly implements the required interface.
    
    Args:
        adapter_class: Adapter class to validate
        integration_type: Type of integration to validate against
        
    Returns:
        bool: True if implementation is valid, False otherwise
    """
    try:
        # Get base adapter type
        base_adapter = BASE_ADAPTER_TYPES.get(integration_type)
        if not base_adapter:
            raise ValueError(f"Invalid integration type: {integration_type}")
            
        # Verify inheritance
        if not issubclass(adapter_class, base_adapter):
            logger.error(
                f"Adapter class {adapter_class.__name__} does not implement "
                f"required interface {base_adapter.__name__}"
            )
            return False
            
        logger.info(
            f"Validated adapter implementation {adapter_class.__name__} "
            f"for {integration_type}"
        )
        return True
        
    except Exception as e:
        logger.error(f"Error validating adapter implementation: {str(e)}")
        return False

def get_supported_providers(integration_type: str) -> Dict[str, str]:
    """
    Get mapping of supported providers for a given integration type.
    
    Args:
        integration_type: Type of integration
        
    Returns:
        Dict[str, str]: Mapping of provider keys to implementation names
        
    Raises:
        ValueError: If integration type is invalid
    """
    if integration_type not in ADAPTER_REGISTRY:
        raise ValueError(f"Invalid integration type: {integration_type}")
        
    return ADAPTER_REGISTRY[integration_type].copy()

# Export public interfaces
__all__ = [
    # Registry and helper functions
    'ADAPTER_REGISTRY',
    'get_adapter_class',
    'validate_adapter_implementation',
    'get_supported_providers',
    
    # Base adapter interfaces
    'AnalyticsAdapter',
    'BaseCRMAdapter', 
    'BaseDocumentAdapter',
    
    # Concrete implementations
    'MixpanelAdapter',
    'SalesforceCRMAdapter',
    'GoogleDriveAdapter',
    'DropboxAdapter'
]