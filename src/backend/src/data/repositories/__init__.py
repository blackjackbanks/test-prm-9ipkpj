"""
Repository package initializer providing centralized access to data layer components
with type-safe imports, comprehensive documentation, and performance optimization.

Version: 1.0.0
"""

from typing import Dict, List, Optional, Type, TypeVar, Union
from uuid import UUID

# Import repository implementations with version tracking
from data.repositories.base import BaseRepository  # v1.0.0
from data.repositories.user import UserRepository  # v1.0.0
from data.repositories.organization import OrganizationRepository  # v1.0.0
from data.repositories.template import TemplateRepository  # v1.0.0
from data.repositories.integration import IntegrationRepository  # v1.0.0
from data.repositories.context import ContextRepository  # v1.0.0

# Define package metadata
__version__ = "1.0.0"
__author__ = "COREos Development Team"

# Export repository classes and common types
__all__ = [
    "BaseRepository",
    "UserRepository",
    "OrganizationRepository", 
    "TemplateRepository",
    "IntegrationRepository",
    "ContextRepository"
]

# Type variable for repository models
T = TypeVar('T')

# Repository factory cache for singleton pattern
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

# Export factory function
__all__.append("get_repository")

# Type hints for repository operations
RepositoryResult = Union[T, List[T], None]
RepositoryFilter = Dict[str, Union[str, int, UUID, bool]]
RepositorySort = List[Dict[str, bool]]  # [{field: asc/desc}, ...]

# Export type definitions
__all__.extend([
    "RepositoryResult",
    "RepositoryFilter", 
    "RepositorySort"
])

# Repository configuration defaults
DEFAULT_PAGE_SIZE: int = 50
MAX_PAGE_SIZE: int = 100
DEFAULT_CACHE_TTL: int = 3600  # 1 hour

# Export configuration constants
__all__.extend([
    "DEFAULT_PAGE_SIZE",
    "MAX_PAGE_SIZE", 
    "DEFAULT_CACHE_TTL"
])

def clear_repository_cache() -> None:
    """
    Clear all repository instance caches.
    Useful for testing and cache invalidation.
    """
    _repository_instances.clear()

# Export cache management
__all__.append("clear_repository_cache")

# Version compatibility check
def check_version_compatibility() -> bool:
    """
    Verify version compatibility across repository implementations.
    
    Returns:
        bool: True if all versions are compatible
        
    Raises:
        ImportError: If incompatible versions are detected
    """
    required_version = "1.0.0"
    repo_versions = {
        "BaseRepository": BaseRepository.__version__,
        "UserRepository": UserRepository.__version__,
        "OrganizationRepository": OrganizationRepository.__version__,
        "TemplateRepository": TemplateRepository.__version__,
        "IntegrationRepository": IntegrationRepository.__version__,
        "ContextRepository": ContextRepository.__version__
    }
    
    for repo, version in repo_versions.items():
        if version != required_version:
            raise ImportError(
                f"Version mismatch for {repo}: "
                f"expected {required_version}, got {version}"
            )
    return True

# Export version checker
__all__.append("check_version_compatibility")

# Initialize version compatibility check
check_version_compatibility()