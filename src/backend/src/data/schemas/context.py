"""
Pydantic schema definitions for business context data validation and serialization.
Implements comprehensive validation rules, security measures, and performance optimizations.

Version: 1.0.0
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from uuid import UUID

from pydantic import BaseModel, Field, validator, root_validator

from data.models.context import Context, CONTEXT_TYPES
from utils.validators import validate_uuid

# Current schema version for version tracking
SCHEMA_VERSION = "1.0.0"

# Content schemas for different context types
CONTENT_SCHEMAS = {
    "business_analysis": {
        "metrics": List[Dict[str, Any]],
        "insights": List[str],
        "recommendations": List[Dict[str, Any]]
    },
    "strategy": {
        "objectives": List[Dict[str, Any]],
        "actions": List[Dict[str, Any]],
        "timeline": Dict[str, Any]
    },
    "operational": {
        "processes": List[Dict[str, Any]],
        "resources": Dict[str, Any],
        "status": str
    },
    "market_data": {
        "indicators": List[Dict[str, Any]],
        "trends": List[Dict[str, Any]],
        "competitors": List[Dict[str, Any]]
    },
    "ai_insight": {
        "analysis": Dict[str, Any],
        "confidence_score": float,
        "data_points": List[Dict[str, Any]]
    }
}

class ContextBase(BaseModel):
    """Enhanced base Pydantic model for context data validation."""
    
    organization_id: UUID = Field(..., description="Organization UUID")
    type: str = Field(..., description="Context type", max_length=50)
    content: Dict[str, Any] = Field(..., description="Context data content")
    schema_version: str = Field(default=SCHEMA_VERSION, description="Schema version")

    @validator("type")
    def validate_type(cls, value: str) -> str:
        """Validate context type against allowed types."""
        if value not in CONTEXT_TYPES:
            raise ValueError(f"Invalid context type. Must be one of: {CONTEXT_TYPES}")
        return value.lower()

    @validator("organization_id")
    def validate_organization_id(cls, value: UUID) -> UUID:
        """Validate organization UUID format."""
        validate_uuid(str(value))
        return value

    @root_validator
    def validate_content(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate content structure based on context type."""
        if "type" not in values or "content" not in values:
            raise ValueError("Both type and content must be provided")

        context_type = values["type"]
        content = values["content"]

        # Validate against type-specific schema
        required_fields = CONTENT_SCHEMAS[context_type].keys()
        for field in required_fields:
            if field not in content:
                raise ValueError(f"Missing required field '{field}' for type '{context_type}'")

        # Validate field types
        for field, value in content.items():
            expected_type = CONTENT_SCHEMAS[context_type][field]
            if not isinstance(value, expected_type):
                raise ValueError(f"Invalid type for field '{field}'. Expected {expected_type}")

        # Sanitize content
        sanitized = {}
        for key, value in content.items():
            if isinstance(value, str):
                sanitized[key] = value.strip()
            else:
                sanitized[key] = value

        values["content"] = sanitized
        return values

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        arbitrary_types_allowed = True

class ContextCreate(ContextBase):
    """Schema for creating new context entries."""
    pass

class ContextResponse(ContextBase):
    """Schema for context data responses with metadata."""
    
    id: UUID = Field(..., description="Context entry UUID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    @validator("created_at", "updated_at", pre=True)
    def ensure_timezone(cls, value: datetime) -> datetime:
        """Ensure timestamps are timezone-aware."""
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

class ContextUpdate(BaseModel):
    """Schema for updating existing context entries."""
    
    type: Optional[str] = Field(None, description="Updated context type")
    content: Optional[Dict[str, Any]] = Field(None, description="Updated content")
    schema_version: Optional[str] = Field(None, description="Updated schema version")

    @validator("type")
    def validate_type(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional type update."""
        if value is not None:
            if value not in CONTEXT_TYPES:
                raise ValueError(f"Invalid context type. Must be one of: {CONTEXT_TYPES}")
            return value.lower()
        return value

    @root_validator
    def validate_update(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that at least one field is being updated."""
        if not any(values.values()):
            raise ValueError("At least one field must be provided for update")
        return values

    class Config:
        arbitrary_types_allowed = True