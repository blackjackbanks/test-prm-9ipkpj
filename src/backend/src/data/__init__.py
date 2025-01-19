"""
Main data package initializer providing centralized access to data-related components
with lazy loading, type safety, and comprehensive validation.

Version: 1.0.0
"""

from typing import Dict, List, Optional, Type, TypeVar
import importlib
import logging
from datetime import datetime

# Import core models
from data.models import (
    Context, Integration, IntegrationType, Organization, Template, User
)

# Import Pydantic schemas
from data.schemas import (
    ContextBase, ContextCreate, ContextResponse, ContextUpdate,
    IntegrationBase, IntegrationCreate, IntegrationUpdate, IntegrationResponse,
    OrganizationBase, OrganizationCreate, OrganizationUpdate, OrganizationInDB,
    TemplateBase, TemplateCreate, TemplateUpdate, TemplateInDB,
    UserBase, UserCreate, UserUpdate, UserInDB
)

# Import repositories
from data.repositories import (
    BaseRepository, UserRepository, OrganizationRepository,
    TemplateRepository, IntegrationRepository, ContextRepository
)

# Configure logging
logger = logging.getLogger(__name__)

# Package metadata
__version__ = "1.0.0"
__all__ = [
    # Models
    "Context",
    "Integration",
    "IntegrationType",
    "Organization", 
    "Template",
    "User",
    
    # Schemas
    "ContextBase",
    "ContextCreate",
    "ContextResponse",
    "ContextUpdate",
    "IntegrationBase", 
    "IntegrationCreate",
    "IntegrationUpdate",
    "IntegrationResponse",
    "OrganizationBase",
    "OrganizationCreate", 
    "OrganizationUpdate",
    "OrganizationInDB",
    "TemplateBase",
    "TemplateCreate",
    "TemplateUpdate",
    "TemplateInDB",
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    
    # Repositories
    "BaseRepository",
    "UserRepository",
    "OrganizationRepository",
    "TemplateRepository", 
    "IntegrationRepository",
    "ContextRepository"
]

# Type variable for repository models
T = TypeVar('T')

# Repository instance cache
_repository_instances: Dict[str, BaseRepository] = {}

def get_repository(repo_class: Type[BaseRepository[T]]) -> BaseRepository[T]:
    """
    Get or create repository instance with singleton pattern and caching.
    
    Args:
        repo_class: Repository class to instantiate
        
    Returns:
        Repository instance of specified type
        
    Example:
        >>> user_repo = get_repository(UserRepository)
    """
    repo_name = repo_class.__name__
    if repo_name not in _repository_instances:
        _repository_instances[repo_name] = repo_class()
    return _repository_instances[repo_name]

def clear_repository_cache() -> None:
    """Clear all repository instance caches."""
    _repository_instances.clear()
    logger.info("Repository cache cleared")

def check_version_compatibility() -> bool:
    """
    Verify version compatibility across all data components.
    
    Returns:
        bool: True if all versions are compatible
        
    Raises:
        ImportError: If incompatible versions are detected
    """
    required_version = "1.0.0"
    component_versions = {
        "models": getattr(importlib.import_module("data.models"), "__version__", None),
        "schemas": getattr(importlib.import_module("data.schemas"), "__version__", None),
        "repositories": getattr(importlib.import_module("data.repositories"), "__version__", None)
    }
    
    for component, version in component_versions.items():
        if version != required_version:
            raise ImportError(
                f"Version mismatch for {component}: "
                f"expected {required_version}, got {version}"
            )
    return True

# Initialize version compatibility check
check_version_compatibility()

# Export utility functions
__all__.extend([
    "get_repository",
    "clear_repository_cache",
    "check_version_compatibility"
])

# Log package initialization
logger.info(f"COREos data package v{__version__} initialized successfully")