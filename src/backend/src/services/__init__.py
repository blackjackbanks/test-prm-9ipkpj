"""
Service layer initialization module that exports core business services for the COREos platform.
Provides centralized access to all service classes that implement business logic and orchestrate
operations between data layer and API endpoints.

Version: 1.0.0
"""

import logging
from typing import Dict, Optional, Any

# Import core service classes
from services.context_service import ContextService
from services.integration_service import IntegrationService
from services.template_service import TemplateService
from services.organization_service import OrganizationService
from services.user_service import UserService

# Module version
__version__ = "1.0.0"

# Export service classes
__all__ = [
    "ContextService",
    "IntegrationService",
    "TemplateService",
    "OrganizationService",
    "UserService"
]

# Configure logging
logger = logging.getLogger(__name__)

def _initialize_services() -> bool:
    """
    Internal function to safely initialize all service classes with error handling.
    
    Returns:
        bool: True if all services initialized successfully, False otherwise
    """
    try:
        # Log initialization start
        logger.info("Initializing COREos service layer...")
        
        # Verify service compatibility
        if not _verify_service_compatibility():
            logger.error("Service compatibility check failed")
            return False
            
        # Log successful initialization
        logger.info(
            f"Service layer initialized successfully (version {__version__})"
        )
        return True
        
    except Exception as e:
        logger.error(f"Service layer initialization failed: {str(e)}")
        return False

def _verify_service_compatibility() -> bool:
    """
    Internal function to verify version compatibility between services.
    
    Returns:
        bool: True if all services are compatible, False otherwise
    """
    try:
        # Define required versions
        required_versions = {
            "ContextService": "1.0.0",
            "IntegrationService": "1.0.0",
            "TemplateService": "1.0.0",
            "OrganizationService": "1.0.0",
            "UserService": "1.0.0"
        }
        
        # Verify each service version
        for service_name, required_version in required_versions.items():
            service_class = globals().get(service_name)
            if not service_class:
                logger.error(f"Service {service_name} not found")
                return False
                
            service_version = getattr(service_class, "__version__", None)
            if not service_version or service_version != required_version:
                logger.error(
                    f"Version mismatch for {service_name}: "
                    f"required={required_version}, found={service_version}"
                )
                return False
                
        return True
        
    except Exception as e:
        logger.error(f"Service compatibility check failed: {str(e)}")
        return False

# Initialize services on module import
if not _initialize_services():
    raise RuntimeError("Failed to initialize COREos service layer")