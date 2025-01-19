"""
Custom exception classes for the COREos backend application providing standardized 
error handling and consistent error responses across the system.

Version: 1.0.0
"""

from typing import Dict, Optional, Any  # Python 3.11+
from fastapi import HTTPException  # FastAPI 0.100+
from datetime import datetime
import uuid

from utils.constants import HTTPStatusCodes, ErrorCodes

class COREosBaseException(HTTPException):
    """
    Base exception class for all custom COREos exceptions with enhanced error tracking
    and logging support. Provides standardized error response format and secure error handling.
    """
    
    def __init__(
        self,
        message: str,
        error_code: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None
    ) -> None:
        """
        Initialize base exception with comprehensive error details and tracking information.
        
        Args:
            message: Human-readable error message
            error_code: Unique error identifier code
            details: Additional error context and metadata
            status_code: HTTP status code for the error
        """
        # Call parent HTTPException constructor
        super().__init__(
            status_code=status_code or HTTPStatusCodes.INTERNAL_SERVER_ERROR.value
        )
        
        # Validate and sanitize inputs
        self.message = self._sanitize_message(message)
        self.error_code = self._validate_error_code(error_code)
        self.details = self._sanitize_details(details or {})
        self.status_code = status_code or HTTPStatusCodes.INTERNAL_SERVER_ERROR.value
        
        # Add error tracking metadata
        self.request_id = str(uuid.uuid4())
        self.timestamp = datetime.utcnow().isoformat()
        
    def _sanitize_message(self, message: str) -> str:
        """Sanitize error message to prevent information leakage."""
        return message.strip()[:1000]  # Limit message length
        
    def _validate_error_code(self, error_code: str) -> str:
        """Validate error code format and range."""
        if not isinstance(error_code, str) or not error_code:
            raise ValueError("Invalid error code format")
        return error_code
        
    def _sanitize_details(self, details: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize error details to remove sensitive information."""
        sanitized = {}
        for key, value in details.items():
            # Remove sensitive keys
            if key.lower() not in {'password', 'token', 'secret', 'key'}:
                sanitized[key] = value
        return sanitized

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert exception to dictionary format for API responses.
        
        Returns:
            Dict containing structured error response
        """
        return {
            'error': {
                'code': self.error_code,
                'message': self.message,
                'details': self.details,
                'request_id': self.request_id,
                'timestamp': self.timestamp
            },
            'status_code': self.status_code
        }

class AuthenticationException(COREosBaseException):
    """
    Exception for authentication and authorization errors with enhanced security logging.
    Error codes range: 1000-1999
    """
    
    def __init__(
        self,
        message: str,
        error_code: str = ErrorCodes.AUTH_FAILED.value,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize authentication exception with secure error handling."""
        super().__init__(
            message=message,
            error_code=error_code,
            details=details,
            status_code=HTTPStatusCodes.UNAUTHORIZED.value
        )

class ValidationException(COREosBaseException):
    """
    Exception for data validation errors with detailed validation context.
    Error codes range: 2000-2999
    """
    
    def __init__(
        self,
        message: str,
        error_code: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize validation exception with validation context."""
        super().__init__(
            message=message,
            error_code=error_code,
            details=details,
            status_code=HTTPStatusCodes.BAD_REQUEST.value
        )

class NotFoundException(COREosBaseException):
    """
    Exception for resource not found errors with resource tracking.
    Error codes range: 3000-3999
    """
    
    def __init__(
        self,
        message: str,
        error_code: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize not found exception with resource information."""
        super().__init__(
            message=message,
            error_code=error_code,
            details=details,
            status_code=HTTPStatusCodes.NOT_FOUND.value
        )

class IntegrationException(COREosBaseException):
    """
    Exception for external integration errors with detailed diagnostics.
    Error codes range: 4000-4999
    """
    
    def __init__(
        self,
        message: str,
        error_code: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize integration exception with integration context."""
        super().__init__(
            message=message,
            error_code=error_code,
            details=details,
            status_code=HTTPStatusCodes.BAD_GATEWAY.value
        )