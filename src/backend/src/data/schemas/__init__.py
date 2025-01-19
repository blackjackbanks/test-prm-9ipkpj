"""
Centralized schema definitions module for the COREos platform.
Provides comprehensive data validation, serialization, and security measures.

Version: 1.0.0
"""

from typing import Dict, Optional, Callable
from cachetools import TTLCache  # v5.0.0

# Import schema classes from individual modules
from data.schemas.context import (
    ContextBase,
    ContextCreate,
    ContextResponse,
    ContextUpdate
)
from data.schemas.integration import (
    IntegrationBase,
    IntegrationCreate,
    IntegrationUpdate,
    IntegrationResponse
)
from data.schemas.organization import (
    OrganizationBase,
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationInDB
)
from data.schemas.template import (
    TemplateBase,
    TemplateCreate,
    TemplateUpdate,
    TemplateInDB
)
from data.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB
)

# Schema version tracking
SCHEMA_VERSION = "1.0.0"

# Cache configuration for schema validation
SCHEMA_CACHE_TTL = 300  # 5 minutes cache TTL
_schema_cache = TTLCache(maxsize=100, ttl=SCHEMA_CACHE_TTL)

# Error handlers for validation failures
VALIDATION_ERROR_HANDLERS: Dict[str, Callable] = {
    "context": lambda err: f"Context validation error: {str(err)}",
    "integration": lambda err: f"Integration validation error: {str(err)}",
    "organization": lambda err: f"Organization validation error: {str(err)}",
    "template": lambda err: f"Template validation error: {str(err)}",
    "user": lambda err: f"User validation error: {str(err)}"
}

def validate_schema_version(schema_name: str, version: str) -> bool:
    """
    Validates schema version compatibility.

    Args:
        schema_name: Name of the schema to validate
        version: Version to validate against

    Returns:
        bool: True if version is compatible
    """
    if not version:
        return False

    # Split versions into components
    current = [int(x) for x in SCHEMA_VERSION.split(".")]
    target = [int(x) for x in version.split(".")]

    # Major version must match for compatibility
    if current[0] != target[0]:
        return False

    # Minor version must be greater or equal
    if current[1] < target[1]:
        return False

    return True

def get_cached_schema(schema_name: str) -> Optional[dict]:
    """
    Retrieves cached schema if available.

    Args:
        schema_name: Name of the schema to retrieve

    Returns:
        Optional[dict]: Cached schema if found and valid
    """
    return _schema_cache.get(schema_name)

# Export all schema classes
__all__ = [
    # Context schemas
    "ContextBase",
    "ContextCreate",
    "ContextResponse",
    "ContextUpdate",
    
    # Integration schemas
    "IntegrationBase",
    "IntegrationCreate",
    "IntegrationUpdate",
    "IntegrationResponse",
    
    # Organization schemas
    "OrganizationBase",
    "OrganizationCreate",
    "OrganizationUpdate",
    "OrganizationInDB",
    
    # Template schemas
    "TemplateBase",
    "TemplateCreate",
    "TemplateUpdate",
    "TemplateInDB",
    
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    
    # Utilities
    "validate_schema_version",
    "get_cached_schema",
    
    # Constants
    "SCHEMA_VERSION",
    "VALIDATION_ERROR_HANDLERS"
]