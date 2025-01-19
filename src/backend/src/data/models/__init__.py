"""
SQLAlchemy models package initializer for COREos platform.
Provides centralized access to all database models with proper dependency management.

Version: 1.0.0
"""

from data.models.context import Context
from data.models.integration import Integration, IntegrationType
from data.models.organization import Organization
from data.models.template import Template
from data.models.user import User, UserRole

# Export all models for centralized access
__all__ = [
    # Core models
    'Context',
    'Integration',
    'IntegrationType',
    'Organization', 
    'Template',
    'User',
    'UserRole',
]

# Model version mapping for schema compatibility checks
MODEL_VERSIONS = {
    'Context': '1.0.0',
    'Integration': '1.0.0',
    'Organization': '1.0.0',
    'Template': '1.0.0',
    'User': '1.0.0'
}

# Model relationships for dependency resolution
MODEL_DEPENDENCIES = {
    'User': ['Organization'],
    'Integration': ['Organization'],
    'Template': ['Organization'],
    'Context': ['Organization']
}

# Model initialization order to maintain referential integrity
INITIALIZATION_ORDER = [
    'Organization',  # Base model with no dependencies
    'User',         # Depends on Organization
    'Integration',  # Depends on Organization
    'Template',     # Depends on Organization
    'Context'       # Depends on Organization
]

def get_model_version(model_name: str) -> str:
    """
    Get the version of a specific model.

    Args:
        model_name: Name of the model to check

    Returns:
        str: Version string of the model
    """
    return MODEL_VERSIONS.get(model_name)

def get_model_dependencies(model_name: str) -> list:
    """
    Get dependencies for a specific model.

    Args:
        model_name: Name of the model to check

    Returns:
        list: List of dependent model names
    """
    return MODEL_DEPENDENCIES.get(model_name, [])

def get_initialization_order() -> list:
    """
    Get the correct order for model initialization.

    Returns:
        list: Ordered list of model names
    """
    return INITIALIZATION_ORDER.copy()