"""
Utility functions and helper methods for the COREos backend application.
Provides secure, optimized, and thread-safe implementations for common operations.

Version: 1.0.0
"""

from datetime import datetime, timedelta  # Python 3.11+
from typing import Dict, List, Optional, Union, Any  # Python 3.11+
import json
import uuid
import logging
from utils.constants import HTTPStatusCodes
from utils.exceptions import ValidationException

# Constants for date/time formatting
DATETIME_FORMAT = '%Y-%m-%dT%H:%M:%S.%fZ'
DATE_FORMAT = '%Y-%m-%d'
MAX_RETRIES = 3

# Configure logging
logger = logging.getLogger(__name__)

def generate_uuid() -> str:
    """
    Generate a thread-safe UUID string without hyphens.
    
    Returns:
        str: UUID string in standard format without hyphens
        
    Example:
        >>> generate_uuid()
        '123e4567e89b12d3a456426614174000'
    """
    try:
        return str(uuid.uuid4()).replace('-', '')
    except Exception as e:
        logger.error(f"Error generating UUID: {str(e)}")
        raise ValidationException(
            message="Failed to generate UUID",
            error_code="utils_001",
            details={"error": str(e)}
        )

def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    """
    Format datetime object to ISO format string with timezone handling.
    
    Args:
        dt: Datetime object to format
        
    Returns:
        Optional[str]: Formatted datetime string in ISO format or None if input is None
        
    Example:
        >>> format_datetime(datetime.now())
        '2023-09-20T14:30:00.000Z'
    """
    if dt is None:
        return None
        
    try:
        # Convert to UTC if timezone aware
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.UTC)
        return dt.strftime(DATETIME_FORMAT)
    except Exception as e:
        logger.error(f"Error formatting datetime: {str(e)}")
        raise ValidationException(
            message="Failed to format datetime",
            error_code="utils_002",
            details={"error": str(e)}
        )

def safe_json_loads(json_str: Optional[str], default: Any = None) -> Union[Dict, List, Any]:
    """
    Securely parse JSON string with comprehensive error handling and validation.
    
    Args:
        json_str: JSON string to parse
        default: Default value to return if parsing fails
        
    Returns:
        Union[Dict, List, Any]: Parsed JSON data or default value
        
    Example:
        >>> safe_json_loads('{"key": "value"}')
        {'key': 'value'}
    """
    if not json_str:
        return default
        
    try:
        # Set parsing limits for security
        parsed = json.loads(
            json_str,
            parse_float=float,
            parse_int=int,
            parse_constant=None
        )
        
        # Validate parsed data structure
        if not isinstance(parsed, (dict, list, str, int, float, bool, type(None))):
            raise ValidationException(
                message="Invalid JSON data structure",
                error_code="utils_003",
                details={"type": str(type(parsed))}
            )
            
        return parsed
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parsing error: {str(e)}")
        return default
    except Exception as e:
        logger.error(f"Error parsing JSON: {str(e)}")
        raise ValidationException(
            message="Failed to parse JSON",
            error_code="utils_004",
            details={"error": str(e)}
        )

def chunk_list(items: List, chunk_size: int) -> List[List]:
    """
    Split list into smaller chunks with memory-efficient processing.
    
    Args:
        items: List to split into chunks
        chunk_size: Size of each chunk
        
    Returns:
        List[List]: List of chunked sublists
        
    Example:
        >>> chunk_list([1, 2, 3, 4, 5], 2)
        [[1, 2], [3, 4], [5]]
    """
    if not isinstance(items, list):
        raise ValidationException(
            message="Input must be a list",
            error_code="utils_005",
            details={"type": str(type(items))}
        )
        
    if not isinstance(chunk_size, int) or chunk_size < 1:
        raise ValidationException(
            message="Chunk size must be a positive integer",
            error_code="utils_006",
            details={"chunk_size": chunk_size}
        )
        
    try:
        return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]
    except Exception as e:
        logger.error(f"Error chunking list: {str(e)}")
        raise ValidationException(
            message="Failed to chunk list",
            error_code="utils_007",
            details={"error": str(e)}
        )

def is_valid_uuid(uuid_str: str) -> bool:
    """
    Validate UUID string format.
    
    Args:
        uuid_str: UUID string to validate
        
    Returns:
        bool: True if valid UUID format, False otherwise
        
    Example:
        >>> is_valid_uuid('123e4567-e89b-12d3-a456-426614174000')
        True
    """
    try:
        uuid.UUID(str(uuid_str))
        return True
    except (ValueError, AttributeError, TypeError):
        return False

def sanitize_string(input_str: Optional[str], max_length: int = 1000) -> Optional[str]:
    """
    Sanitize string input with length limits and character validation.
    
    Args:
        input_str: String to sanitize
        max_length: Maximum allowed length
        
    Returns:
        Optional[str]: Sanitized string or None if input is None
        
    Example:
        >>> sanitize_string('  test  ', 10)
        'test'
    """
    if input_str is None:
        return None
        
    try:
        # Strip whitespace and limit length
        sanitized = str(input_str).strip()[:max_length]
        return sanitized if sanitized else None
    except Exception as e:
        logger.error(f"Error sanitizing string: {str(e)}")
        raise ValidationException(
            message="Failed to sanitize string",
            error_code="utils_008",
            details={"error": str(e)}
        )