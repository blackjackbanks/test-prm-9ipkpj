"""
Pydantic schema definitions for User data validation and serialization in the COREos platform.
Implements comprehensive data validation, sanitization, and security measures.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, Optional
from uuid import UUID
from pydantic import BaseModel, Field, validator

from utils.validators import validate_email, validate_password, validate_uuid
from data.schemas.organization import OrganizationInDB

# Available user roles for validation
USER_ROLES = ["admin", "standard", "integration"]

class UserBase(BaseModel):
    """
    Base Pydantic model for user data validation with comprehensive field validation.
    """
    email: str = Field(
        ...,
        description="User email address with format validation"
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="User full name"
    )
    organization_id: UUID = Field(
        ...,
        description="Organization UUID the user belongs to"
    )
    role: str = Field(
        ...,
        description="User role within the organization"
    )
    preferences: Dict = Field(
        default_factory=dict,
        description="User-specific preferences and settings"
    )

    @validator("email")
    def validate_user_email(cls, value: str) -> str:
        """
        Validates user email format with enhanced checks.
        
        Args:
            value: Email to validate
            
        Returns:
            str: Validated email
            
        Raises:
            ValueError: If email validation fails
        """
        if not value or not isinstance(value, str):
            raise ValueError("Email cannot be empty")
        
        # Validate email format and domain
        validate_email(value)
        return value.lower()

    @validator("role")
    def validate_user_role(cls, value: str) -> str:
        """
        Validates user role against allowed roles.
        
        Args:
            value: Role to validate
            
        Returns:
            str: Validated role
            
        Raises:
            ValueError: If role validation fails
        """
        if not value or not isinstance(value, str):
            raise ValueError("Role cannot be empty")
            
        value = value.lower()
        if value not in USER_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(USER_ROLES)}")
            
        return value

    class Config:
        """Pydantic model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        extra = "forbid"
        str_strip_whitespace = True

class UserCreate(UserBase):
    """
    Schema for creating a new user with enhanced validation.
    """
    password: str = Field(
        ...,
        min_length=8,
        description="User password with security policy enforcement"
    )
    preferences: Optional[Dict] = Field(
        default_factory=dict,
        description="Optional user preferences for creation"
    )

    @validator("password")
    def validate_user_password(cls, value: str) -> str:
        """
        Validates user password strength with security policies.
        
        Args:
            value: Password to validate
            
        Returns:
            str: Validated password
            
        Raises:
            ValueError: If password validation fails
        """
        if not value or not isinstance(value, str):
            raise ValueError("Password cannot be empty")
            
        # Validate password strength and security
        validate_password(value)
        return value

class UserUpdate(BaseModel):
    """
    Schema for updating an existing user with partial updates.
    """
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    organization_id: Optional[UUID] = None
    role: Optional[str] = None
    preferences: Optional[Dict] = None

    @validator("email")
    def validate_optional_email(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional email update"""
        if value is None:
            return value
        return UserBase.validate_user_email(None, value)

    @validator("password")
    def validate_optional_password(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional password update"""
        if value is None:
            return value
        return UserCreate.validate_user_password(None, value)

    @validator("role")
    def validate_optional_role(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional role update"""
        if value is None:
            return value
        return UserBase.validate_user_role(None, value)

    class Config:
        """Pydantic model configuration for updates"""
        validate_assignment = True
        extra = "forbid"

class UserInDB(UserBase):
    """
    Schema for user data from database with relationship handling.
    """
    id: UUID = Field(
        ...,
        description="User unique identifier"
    )
    hashed_password: str = Field(
        ...,
        description="Securely hashed user password"
    )
    created_at: datetime = Field(
        ...,
        description="User creation timestamp"
    )
    updated_at: datetime = Field(
        ...,
        description="User last update timestamp"
    )
    organization: OrganizationInDB = Field(
        ...,
        description="Related organization data"
    )

    @validator("id")
    def validate_user_id(cls, value: UUID) -> UUID:
        """
        Validates user ID with format checking.
        
        Args:
            value: UUID to validate
            
        Returns:
            UUID: Validated UUID
            
        Raises:
            ValueError: If UUID validation fails
        """
        if not value:
            raise ValueError("User ID cannot be empty")
            
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