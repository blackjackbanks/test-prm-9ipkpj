"""
FastAPI exception handlers for standardized error handling across the COREos backend application.
Implements secure error handling with comprehensive logging and monitoring.

Version: 1.0.0
"""

import uuid
from typing import Dict, Any

from fastapi import Request  # FastAPI 0.100+
from fastapi import HTTPException, RequestValidationError  # FastAPI 0.100+
from fastapi.responses import JSONResponse  # FastAPI 0.100+
import logging  # Python 3.11+

from utils.exceptions import (
    COREosBaseException,
    AuthenticationException,
    ValidationException,
    NotFoundException,
    IntegrationException
)
from utils.constants import HTTPStatusCodes, ErrorCodes

# Configure structured logging
logger = logging.getLogger(__name__)

async def handle_coreos_exception(request: Request, exc: COREosBaseException) -> JSONResponse:
    """
    Enhanced global exception handler for COREos custom exceptions with security measures.
    
    Args:
        request: FastAPI request object
        exc: COREos base exception instance
    
    Returns:
        JSONResponse with sanitized error details
    """
    # Generate unique error tracking ID
    error_id = str(uuid.uuid4())
    
    # Create structured error log
    log_data = {
        'error_id': error_id,
        'error_code': exc.error_code,
        'status_code': exc.status_code,
        'path': str(request.url),
        'method': request.method,
        'client_ip': request.client.host if request.client else None,
        'user_agent': request.headers.get('user-agent'),
        'correlation_id': request.headers.get('x-correlation-id'),
        'details': exc.details
    }
    
    # Log error with context
    logger.error(
        f"COREos exception occurred: {exc.message}",
        extra=log_data
    )
    
    # Construct sanitized error response
    error_response = {
        'error': {
            'code': exc.error_code,
            'message': exc.message,
            'error_id': error_id,
            'details': exc.details  # Already sanitized in base exception
        }
    }
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )

async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Enhanced handler for request validation errors with detailed field validation.
    
    Args:
        request: FastAPI request object
        exc: Request validation error instance
    
    Returns:
        JSONResponse with formatted validation errors
    """
    error_id = str(uuid.uuid4())
    
    # Format validation errors
    validation_errors = []
    for error in exc.errors():
        validation_errors.append({
            'field': ' -> '.join([str(loc) for loc in error['loc']]),
            'message': error['msg'],
            'type': error['type']
        })
    
    # Log validation error details
    log_data = {
        'error_id': error_id,
        'path': str(request.url),
        'method': request.method,
        'validation_errors': validation_errors,
        'correlation_id': request.headers.get('x-correlation-id')
    }
    
    logger.warning(
        "Request validation failed",
        extra=log_data
    )
    
    # Construct validation error response
    error_response = {
        'error': {
            'code': ErrorCodes.BAD_REQUEST.value,
            'message': 'Request validation failed',
            'error_id': error_id,
            'details': {
                'validation_errors': validation_errors
            }
        }
    }
    
    return JSONResponse(
        status_code=HTTPStatusCodes.BAD_REQUEST.value,
        content=error_response
    )

async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Enhanced handler for FastAPI HTTP exceptions with security context.
    
    Args:
        request: FastAPI request object
        exc: HTTP exception instance
    
    Returns:
        JSONResponse with secure error details
    """
    error_id = str(uuid.uuid4())
    
    # Log HTTP exception
    log_data = {
        'error_id': error_id,
        'status_code': exc.status_code,
        'path': str(request.url),
        'method': request.method,
        'correlation_id': request.headers.get('x-correlation-id')
    }
    
    logger.warning(
        f"HTTP exception occurred: {exc.detail}",
        extra=log_data
    )
    
    # Construct HTTP error response
    error_response = {
        'error': {
            'code': f'http_{exc.status_code}',
            'message': str(exc.detail),
            'error_id': error_id
        }
    }
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )

async def handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    """
    Enhanced catch-all handler for unhandled exceptions with security measures.
    
    Args:
        request: FastAPI request object
        exc: Unhandled exception instance
    
    Returns:
        JSONResponse with secure internal server error
    """
    error_id = str(uuid.uuid4())
    
    # Log critical error with full context
    log_data = {
        'error_id': error_id,
        'error_type': exc.__class__.__name__,
        'path': str(request.url),
        'method': request.method,
        'correlation_id': request.headers.get('x-correlation-id')
    }
    
    logger.critical(
        f"Unhandled exception occurred: {str(exc)}",
        exc_info=True,  # Include traceback
        extra=log_data
    )
    
    # Construct generic error response without sensitive details
    error_response = {
        'error': {
            'code': ErrorCodes.INTERNAL_SERVER_ERROR.value,
            'message': 'An unexpected error occurred',
            'error_id': error_id
        }
    }
    
    return JSONResponse(
        status_code=HTTPStatusCodes.INTERNAL_SERVER_ERROR.value,
        content=error_response
    )