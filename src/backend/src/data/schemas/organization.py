"""
Pydantic schema definitions for Organization data validation and serialization in the COREos platform.
Implements comprehensive data validation, sanitization, and security measures.

Version: 1.0.0
"""

from datetime import datetime  # Python 3.11+
from typing import Dict, List, Optional  # Python 3.11+
from uuid import UUID  # Python 3.11+
from pydantic import BaseModel, Field, validator  # pydantic 2.0+

from utils.validators import validate_uuid, sanitize_string

# Industry choices for validation
INDUSTRY_CHOICES = [
    "Technology",
    "Finance", 
    "Healthcare",
    "Retail",
    "Manufacturing",
    "Other"
]

class OrganizationBase(BaseModel):
    """
    Enhanced base Pydantic model for organization data validation with comprehensive security measures.
    """
    name: str = Field(
        ...,  # Required field
        min_length=2,
        max_length=100,
        description="Organization name with length between 2 and 100 characters"
    )
    industry: str = Field(
        ...,  # Required field
        description="Organization industry category"
    )
    settings: Dict = Field(
        default_factory=dict,
        description="Organization-specific settings and configurations"
    )

    @validator("name")
    def validate_name(cls, value: str) -> str:
        """
        Enhanced validation for organization name with security measures.
        
        Args:
            value: Organization name to validate
            
        Returns:
            str: Validated and sanitized name
            
        Raises:
            ValueError: If name validation fails
        """
        if not value or not value.strip():
            raise ValueError("Organization name cannot be empty")
        
        # Apply security sanitization
        sanitized_name = sanitize_string(value)
        
        if len(sanitized_name) < 2 or len(sanitized_name) > 100:
            raise ValueError("Organization name must be between 2 and 100 characters")
            
        return sanitized_name

    @validator("industry")
    def validate_industry(cls, value: str) -> str:
        """
        Enhanced validation for organization industry with strict checking.
        
        Args:
            value: Industry value to validate
            
        Returns:
            str: Validated industry value
            
        Raises:
            ValueError: If industry validation fails
        """
        if not value or not value.strip():
            raise ValueError("Industry cannot be empty")
            
        # Apply security sanitization
        sanitized_industry = sanitize_string(value)
        
        if sanitized_industry not in INDUSTRY_CHOICES:
            raise ValueError(f"Industry must be one of: {', '.join(INDUSTRY_CHOICES)}")
            
        return sanitized_industry

    class Config:
        """Pydantic model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        extra = "forbid"
        str_strip_whitespace = True

class OrganizationCreate(OrganizationBase):
    """
    Schema for creating a new organization with required fields.
    """
    settings: Optional[Dict] = Field(
        default_factory=dict,
        description="Optional organization settings for creation"
    )

class OrganizationUpdate(BaseModel):
    """
    Schema for updating an existing organization with optional fields.
    """
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100,
        description="Updated organization name"
    )
    industry: Optional[str] = Field(
        None,
        description="Updated organization industry"
    )
    settings: Optional[Dict] = Field(
        None,
        description="Updated organization settings"
    )

    @validator("name")
    def validate_optional_name(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional name update"""
        if value is None:
            return value
        return OrganizationBase.validate_name(None, value)

    @validator("industry")
    def validate_optional_industry(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional industry update"""
        if value is None:
            return value
        return OrganizationBase.validate_industry(None, value)

    class Config:
        """Pydantic model configuration for updates"""
        validate_assignment = True
        extra = "forbid"

class OrganizationInDB(OrganizationBase):
    """
    Enhanced schema for organization data from database with additional security.
    """
    id: UUID = Field(
        ...,
        description="Organization unique identifier"
    )
    created_at: datetime = Field(
        ...,
        description="Organization creation timestamp"
    )
    updated_at: datetime = Field(
        ...,
        description="Organization last update timestamp"
    )

    @validator("id")
    def validate_id(cls, value: UUID) -> UUID:
        """
        Enhanced UUID validation for organization ID.
        
        Args:
            value: UUID to validate
            
        Returns:
            UUID: Validated UUID
            
        Raises:
            ValueError: If UUID validation fails
        """
        if not value:
            raise ValueError("Organization ID cannot be empty")
            
        # Validate UUID format and version
        validate_uuid(str(value))
        
        return value

    class Config:
        """Pydantic model configuration for database schema"""
        orm_mode = True
        validate_assignment = True
        extra = "forbid"
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }