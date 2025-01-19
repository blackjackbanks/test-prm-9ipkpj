"""
Pydantic schema definitions for Template data validation and serialization in the COREos platform.
Provides comprehensive schema validation for template-related operations.

Version: 1.0.0
"""

from datetime import datetime  # Python 3.11+
from typing import Dict, List, Optional  # Python 3.11+
from uuid import UUID  # Python 3.11+
from pydantic import BaseModel, Field, validator  # pydantic 2.0+

from utils.validators import validate_uuid, sanitize_string

# Template categories supported by the system
TEMPLATE_CATEGORIES = [
    "Business Process",
    "Workflow", 
    "Integration",
    "Analysis",
    "Custom"
]

class TemplateBase(BaseModel):
    """Base Pydantic model for template data validation."""
    
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Template name"
    )
    
    category: str = Field(
        ...,
        description="Template category"
    )
    
    content: Dict = Field(
        ...,
        description="Template configuration and content"
    )
    
    version: str = Field(
        ...,
        description="Template semantic version",
        regex=r"^\d+\.\d+\.\d+$"
    )

    @validator("name")
    def validate_name(cls, value: str) -> str:
        """Validates and sanitizes template name."""
        if not value:
            raise ValueError("Template name cannot be empty")
        
        sanitized_name = sanitize_string(value)
        if len(sanitized_name) < 2 or len(sanitized_name) > 100:
            raise ValueError("Template name must be between 2 and 100 characters")
            
        return sanitized_name

    @validator("category")
    def validate_category(cls, value: str) -> str:
        """Validates template category."""
        if not value or value not in TEMPLATE_CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(TEMPLATE_CATEGORIES)}")
        return value

    @validator("version")
    def validate_version(cls, value: str) -> str:
        """Validates semantic version format."""
        if not value or not isinstance(value, str):
            raise ValueError("Version cannot be empty")
            
        # Validate semantic versioning format (major.minor.patch)
        if not value.replace(".", "").isdigit() or len(value.split(".")) != 3:
            raise ValueError("Version must follow semantic versioning format (e.g., 1.0.0)")
            
        return value

class TemplateCreate(TemplateBase):
    """Schema for creating a new template."""
    
    org_id: UUID = Field(
        ...,
        description="Organization ID owning the template"
    )

    @validator("org_id")
    def validate_org_id(cls, value: UUID) -> UUID:
        """Validates organization ID."""
        if not value:
            raise ValueError("Organization ID cannot be empty")
            
        validate_uuid(str(value))
        return value

class TemplateUpdate(BaseModel):
    """Schema for updating an existing template."""
    
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100,
        description="Updated template name"
    )
    
    category: Optional[str] = Field(
        None,
        description="Updated template category"
    )
    
    content: Optional[Dict] = Field(
        None,
        description="Updated template configuration and content"
    )
    
    version: Optional[str] = Field(
        None,
        description="Updated template semantic version",
        regex=r"^\d+\.\d+\.\d+$"
    )

    @validator("name")
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        """Validates and sanitizes template name if provided."""
        if value is None:
            return value
            
        if not value:
            raise ValueError("Template name cannot be empty")
            
        sanitized_name = sanitize_string(value)
        if len(sanitized_name) < 2 or len(sanitized_name) > 100:
            raise ValueError("Template name must be between 2 and 100 characters")
            
        return sanitized_name

    @validator("category")
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        """Validates template category if provided."""
        if value is None:
            return value
            
        if not value or value not in TEMPLATE_CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(TEMPLATE_CATEGORIES)}")
        return value

    @validator("version")
    def validate_version(cls, value: Optional[str]) -> Optional[str]:
        """Validates semantic version format if provided."""
        if value is None:
            return value
            
        if not value or not isinstance(value, str):
            raise ValueError("Version cannot be empty")
            
        if not value.replace(".", "").isdigit() or len(value.split(".")) != 3:
            raise ValueError("Version must follow semantic versioning format (e.g., 1.0.0)")
            
        return value

class TemplateInDB(TemplateBase):
    """Schema for template data from database."""
    
    id: UUID = Field(
        ...,
        description="Template unique identifier"
    )
    
    org_id: UUID = Field(
        ...,
        description="Organization ID owning the template"
    )
    
    created_at: datetime = Field(
        ...,
        description="Template creation timestamp"
    )
    
    updated_at: datetime = Field(
        ...,
        description="Template last update timestamp"
    )

    @validator("id")
    def validate_id(cls, value: UUID) -> UUID:
        """Validates template ID."""
        if not value:
            raise ValueError("Template ID cannot be empty")
            
        validate_uuid(str(value))
        return value

    @validator("org_id")
    def validate_org_id(cls, value: UUID) -> UUID:
        """Validates organization ID."""
        if not value:
            raise ValueError("Organization ID cannot be empty")
            
        validate_uuid(str(value))
        return value

    class Config:
        """Pydantic model configuration."""
        orm_mode = True