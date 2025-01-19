"""
Central constants file containing system-wide configuration values, status codes, 
rate limits, and other constant definitions used across the COREos backend application.

Version: 1.0.0
"""

from enum import Enum, unique  # Python 3.11+
from typing import Final  # Python 3.11+

# API Configuration
API_VERSION: Final[str] = 'v1'

# Rate Limiting Constants
RATE_LIMIT_DEFAULT: Final[int] = 1000  # Default requests per minute
RATE_LIMIT_BURST: Final[int] = 5000    # Maximum burst requests per minute

# Cache Configuration
CACHE_TTL_SECONDS: Final[int] = 3600   # Default cache TTL of 1 hour

# System Configuration
MAX_RETRIES: Final[int] = 3            # Maximum retry attempts for operations
REQUEST_TIMEOUT_SECONDS: Final[int] = 30  # Default request timeout
MAX_CONNECTIONS: Final[int] = 100      # Maximum concurrent connections
BATCH_SIZE: Final[int] = 1000          # Default batch processing size

@unique
class HTTPStatusCodes(Enum):
    """
    Enum class containing HTTP status codes used across the application.
    Ensures unique values for each status code.
    """
    # Success Codes (2xx)
    OK = 200
    CREATED = 201
    NO_CONTENT = 204
    
    # Client Error Codes (4xx)
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    CONFLICT = 409
    
    # Server Error Codes (5xx)
    INTERNAL_SERVER_ERROR = 500
    SERVICE_UNAVAILABLE = 503

@unique
class ErrorCodes(Enum):
    """
    Enum class containing internal error codes and messages.
    Format: <domain>_<number> (e.g., auth_001)
    """
    # Authentication Errors
    AUTH_FAILED = 'auth_001'      # General authentication failure
    INVALID_TOKEN = 'auth_002'    # Invalid or malformed token
    SESSION_EXPIRED = 'auth_003'  # User session has expired
    
    # API Errors
    RATE_LIMITED = 'api_001'      # Rate limit exceeded
    
    # Integration Errors
    INTEGRATION_ERROR = 'int_001' # External integration failure
    
    # Database Errors
    DATABASE_ERROR = 'db_001'     # Database operation failure
    
    # Cache Errors
    CACHE_ERROR = 'cache_001'     # Cache operation failure
    
    # AI Model Errors
    AI_MODEL_ERROR = 'ai_001'     # AI model processing failure

@unique
class IntegrationTypes(Enum):
    """
    Enum class defining supported integration types.
    Used for categorizing and managing external service integrations.
    """
    CRM = 'crm'           # Customer Relationship Management
    DOCUMENT = 'document' # Document Management Systems
    ANALYTICS = 'analytics' # Analytics Platforms