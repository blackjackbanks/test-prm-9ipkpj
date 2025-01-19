"""
Validation utilities module providing comprehensive data validation, input sanitization,
and format verification with enhanced security features for the COREos backend application.

Version: 1.0.0
"""

import re  # Python 3.11+
from datetime import datetime, timezone  # Python 3.11+
from typing import Dict, List, Optional, Union, Any  # Python 3.11+
from email_validator import validate_email as email_validator, EmailNotValidError  # email-validator 2.0+
import html  # Python 3.11+
import bleach  # bleach 6.0+

from utils.exceptions import ValidationException
from utils.constants import ErrorCodes

# Compiled regex patterns for performance optimization
EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
PASSWORD_REGEX = r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$'
UUID_REGEX = r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
URL_REGEX = r'^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$'

COMPILED_EMAIL_REGEX = re.compile(EMAIL_REGEX, re.IGNORECASE)
COMPILED_PASSWORD_REGEX = re.compile(PASSWORD_REGEX)
COMPILED_UUID_REGEX = re.compile(UUID_REGEX, re.IGNORECASE)
COMPILED_URL_REGEX = re.compile(URL_REGEX, re.IGNORECASE)

def validate_email(email: str) -> bool:
    """
    Validates email format and domain with DNS checking.
    
    Args:
        email: Email address to validate
        
    Returns:
        bool: True if email is valid
        
    Raises:
        ValidationException: If email is invalid
    """
    if not email or not isinstance(email, str):
        raise ValidationException(
            message="Email cannot be empty",
            error_code=ErrorCodes.INVALID_EMAIL.value
        )

    # Basic format validation
    if not COMPILED_EMAIL_REGEX.match(email):
        raise ValidationException(
            message="Invalid email format",
            error_code=ErrorCodes.INVALID_EMAIL.value
        )

    try:
        # Validate email with DNS checking
        email_validator(email, check_deliverability=True)
    except EmailNotValidError as e:
        raise ValidationException(
            message=str(e),
            error_code=ErrorCodes.INVALID_EMAIL.value
        )

    return True

def validate_password(password: str) -> bool:
    """
    Validates password strength and format with enhanced security checks.
    
    Args:
        password: Password to validate
        
    Returns:
        bool: True if password meets security requirements
        
    Raises:
        ValidationException: If password is invalid
    """
    if not password or not isinstance(password, str):
        raise ValidationException(
            message="Password cannot be empty",
            error_code=ErrorCodes.INVALID_PASSWORD.value
        )

    if len(password) < 8:
        raise ValidationException(
            message="Password must be at least 8 characters long",
            error_code=ErrorCodes.INVALID_PASSWORD.value
        )

    if not COMPILED_PASSWORD_REGEX.match(password):
        raise ValidationException(
            message="Password must contain at least one letter, one number, and one special character",
            error_code=ErrorCodes.INVALID_PASSWORD.value
        )

    # Check for common password patterns
    common_patterns = ['password', '123456', 'qwerty', 'admin']
    if any(pattern in password.lower() for pattern in common_patterns):
        raise ValidationException(
            message="Password contains common patterns",
            error_code=ErrorCodes.INVALID_PASSWORD.value
        )

    return True

def validate_uuid(uuid_str: str) -> bool:
    """
    Validates UUID format with version 4 specifics.
    
    Args:
        uuid_str: UUID string to validate
        
    Returns:
        bool: True if UUID is valid
        
    Raises:
        ValidationException: If UUID is invalid
    """
    if not uuid_str or not isinstance(uuid_str, str):
        raise ValidationException(
            message="UUID cannot be empty",
            error_code=ErrorCodes.INVALID_UUID.value
        )

    if not COMPILED_UUID_REGEX.match(uuid_str):
        raise ValidationException(
            message="Invalid UUID format",
            error_code=ErrorCodes.INVALID_UUID.value
        )

    return True

def validate_url(url: str, check_accessibility: bool = False) -> bool:
    """
    Validates URL format and optionally checks accessibility.
    
    Args:
        url: URL to validate
        check_accessibility: Whether to check if URL is accessible
        
    Returns:
        bool: True if URL is valid and accessible (if checked)
        
    Raises:
        ValidationException: If URL is invalid
    """
    if not url or not isinstance(url, str):
        raise ValidationException(
            message="URL cannot be empty",
            error_code=ErrorCodes.INVALID_URL.value
        )

    if not COMPILED_URL_REGEX.match(url):
        raise ValidationException(
            message="Invalid URL format",
            error_code=ErrorCodes.INVALID_URL.value
        )

    if check_accessibility:
        try:
            import requests  # Import only when needed
            response = requests.head(url, timeout=5)
            response.raise_for_status()
        except Exception as e:
            raise ValidationException(
                message=f"URL is not accessible: {str(e)}",
                error_code=ErrorCodes.INVALID_URL.value
            )

    return True

def validate_date_range(
    start_date: datetime,
    end_date: datetime,
    max_days: Optional[int] = None
) -> bool:
    """
    Validates date range with timezone awareness and bounds checking.
    
    Args:
        start_date: Start date of the range
        end_date: End date of the range
        max_days: Maximum allowed days between dates
        
    Returns:
        bool: True if date range is valid
        
    Raises:
        ValidationException: If date range is invalid
    """
    if not isinstance(start_date, datetime) or not isinstance(end_date, datetime):
        raise ValidationException(
            message="Invalid date format",
            error_code=ErrorCodes.INVALID_DATE_RANGE.value
        )

    # Normalize timezones to UTC
    start_date = start_date.astimezone(timezone.utc)
    end_date = end_date.astimezone(timezone.utc)

    if start_date >= end_date:
        raise ValidationException(
            message="Start date must be before end date",
            error_code=ErrorCodes.INVALID_DATE_RANGE.value
        )

    if max_days:
        date_diff = (end_date - start_date).days
        if date_diff > max_days:
            raise ValidationException(
                message=f"Date range exceeds maximum allowed days ({max_days})",
                error_code=ErrorCodes.INVALID_DATE_RANGE.value
            )

    return True

def sanitize_string(input_str: str, allowed_tags: Optional[List[str]] = None) -> str:
    """
    Sanitizes string input with comprehensive security measures.
    
    Args:
        input_str: String to sanitize
        allowed_tags: List of allowed HTML tags
        
    Returns:
        str: Sanitized string
    """
    if not input_str or not isinstance(input_str, str):
        return ""

    # Default allowed tags if none specified
    allowed_tags = allowed_tags or ['b', 'i', 'u', 'p', 'br']

    # HTML escape and clean
    escaped_str = html.escape(input_str)
    cleaned_str = bleach.clean(
        escaped_str,
        tags=allowed_tags,
        strip=True,
        strip_comments=True
    )

    # Normalize unicode characters
    normalized_str = cleaned_str.encode('utf-8', 'ignore').decode('utf-8')

    return normalized_str.strip()