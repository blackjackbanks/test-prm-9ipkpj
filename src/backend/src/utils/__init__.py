"""
Core utilities package for the COREos backend application providing secure, optimized,
and type-safe implementations of common operations.

Version: 1.0.0
Author: COREos Team

This package exports commonly used utility functions, constants, exceptions, validators
and cache utilities with comprehensive security features and performance optimizations.
"""

from typing import List

# Version and metadata
__version__ = '1.0.0'
__author__ = 'COREos Team'

# Import constants
from utils.constants import (
    HTTPStatusCodes,
    ErrorCodes,
    IntegrationTypes,
    API_VERSION,
    RATE_LIMIT_DEFAULT,
    CACHE_TTL_SECONDS,
    MAX_RETRIES,
    REQUEST_TIMEOUT_SECONDS,
    MAX_CONNECTIONS,
    BATCH_SIZE
)

# Import exceptions
from utils.exceptions import (
    COREosBaseException,
    AuthenticationException,
    ValidationException,
    NotFoundException,
    IntegrationException
)

# Import helper functions
from utils.helpers import (
    generate_uuid,
    format_datetime,
    parse_datetime,
    format_json_response,
    safe_json_loads,
    chunk_list,
    is_valid_uuid,
    sanitize_string
)

# Import validation functions
from utils.validators import (
    validate_email,
    validate_password,
    validate_uuid,
    validate_url,
    validate_date_range,
    sanitize_string as validate_sanitize_string
)

# Import cache utilities
from utils.cache import (
    get_redis_client,
    set_cache,
    get_cache,
    delete_cache,
    clear_pattern,
    CacheError
)

# Define package exports
__all__: List[str] = [
    # Constants
    'HTTPStatusCodes',
    'ErrorCodes',
    'IntegrationTypes',
    'API_VERSION',
    'RATE_LIMIT_DEFAULT',
    'CACHE_TTL_SECONDS',
    'MAX_RETRIES',
    'REQUEST_TIMEOUT_SECONDS',
    'MAX_CONNECTIONS',
    'BATCH_SIZE',
    
    # Exceptions
    'COREosBaseException',
    'AuthenticationException',
    'ValidationException',
    'NotFoundException',
    'IntegrationException',
    'CacheError',
    
    # Helper Functions
    'generate_uuid',
    'format_datetime',
    'parse_datetime',
    'format_json_response',
    'safe_json_loads',
    'chunk_list',
    'is_valid_uuid',
    'sanitize_string',
    
    # Validation Functions
    'validate_email',
    'validate_password',
    'validate_uuid',
    'validate_url',
    'validate_date_range',
    'validate_sanitize_string',
    
    # Cache Functions
    'get_redis_client',
    'set_cache',
    'get_cache',
    'delete_cache',
    'clear_pattern'
]

# Version compatibility check
import sys
if sys.version_info < (3, 11):
    raise RuntimeError('COREos requires Python 3.11 or higher')

# Initialize cache connection pool on import
try:
    redis_client = get_redis_client()
except CacheError as e:
    import logging
    logging.getLogger(__name__).warning(f"Failed to initialize Redis client: {str(e)}")