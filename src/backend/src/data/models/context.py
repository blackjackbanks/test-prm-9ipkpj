"""
SQLAlchemy model for business context data and AI-processed insights.
Implements comprehensive data validation, security measures, and performance optimizations.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, Optional
from uuid import UUID as PyUUID

from sqlalchemy import Column, ForeignKey, String, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy import func

from config.database import Base

# Valid context types for validation
CONTEXT_TYPES = [
    "business_analysis",
    "strategy", 
    "operational",
    "market_data",
    "ai_insight"
]

class Context(Base):
    """
    SQLAlchemy model for storing business context data and AI-processed insights
    with enhanced validation, security, and performance features.
    """
    __tablename__ = 'contexts'

    # Primary key and relationships
    id = Column(UUID, primary_key=True, server_default=func.gen_random_uuid())
    organization_id = Column(
        UUID, 
        ForeignKey('organizations.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Core fields
    type = Column(String(50), nullable=False, index=True)
    content = Column(JSON, nullable=False)
    
    # Metadata fields
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    audit_log = Column(JSON, nullable=False, default=list)

    def __init__(self, organization_id: PyUUID, type: str, content: Dict):
        """
        Initialize context model with required fields and validation.

        Args:
            organization_id (UUID): Organization ID foreign key
            type (str): Context type from CONTEXT_TYPES
            content (dict): JSON content with context data

        Raises:
            ValueError: If type is invalid or content fails validation
        """
        # Validate type
        if type not in CONTEXT_TYPES:
            raise ValueError(f"Invalid context type. Must be one of: {CONTEXT_TYPES}")

        # Validate content structure based on type
        self._validate_content(type, content)

        # Set core fields
        self.organization_id = organization_id
        self.type = type.lower()
        self.content = self._sanitize_content(content)

        # Set metadata
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.is_deleted = False
        self.version = 1
        self.audit_log = [{
            "action": "created",
            "timestamp": datetime.utcnow().isoformat(),
            "version": 1
        }]

    def update(self, data: Dict) -> None:
        """
        Update context entry with new data and validation.

        Args:
            data (dict): Dictionary containing fields to update

        Raises:
            ValueError: If validation fails for new data
        """
        changes = []

        # Update type if provided
        if "type" in data:
            if data["type"] not in CONTEXT_TYPES:
                raise ValueError(f"Invalid context type. Must be one of: {CONTEXT_TYPES}")
            self.type = data["type"].lower()
            changes.append("type")

        # Update content if provided
        if "content" in data:
            self._validate_content(self.type, data["content"])
            self.content = self._sanitize_content(data["content"])
            changes.append("content")

        # Update metadata
        if changes:
            self.version += 1
            self.updated_at = datetime.utcnow()
            self.audit_log.append({
                "action": "updated",
                "timestamp": datetime.utcnow().isoformat(),
                "version": self.version,
                "changes": changes
            })

    def soft_delete(self) -> None:
        """
        Mark context entry as deleted without removing from database.
        """
        self.is_deleted = True
        self.updated_at = datetime.utcnow()
        self.audit_log.append({
            "action": "deleted",
            "timestamp": datetime.utcnow().isoformat(),
            "version": self.version
        })

    def _validate_content(self, type: str, content: Dict) -> None:
        """
        Validate content structure based on context type.

        Args:
            type (str): Context type
            content (dict): Content to validate

        Raises:
            ValueError: If content fails validation
        """
        if not isinstance(content, dict):
            raise ValueError("Content must be a dictionary")

        # Required fields by type
        required_fields = {
            "business_analysis": ["metrics", "insights", "recommendations"],
            "strategy": ["objectives", "actions", "timeline"],
            "operational": ["processes", "resources", "status"],
            "market_data": ["indicators", "trends", "competitors"],
            "ai_insight": ["analysis", "confidence_score", "data_points"]
        }

        # Validate required fields
        for field in required_fields[type]:
            if field not in content:
                raise ValueError(f"Missing required field '{field}' for type '{type}'")

    def _sanitize_content(self, content: Dict) -> Dict:
        """
        Sanitize content data for security and consistency.

        Args:
            content (dict): Raw content data

        Returns:
            dict: Sanitized content data
        """
        # Deep copy to avoid modifying original
        sanitized = content.copy()

        # Remove any sensitive fields
        sensitive_fields = ["password", "secret", "key", "token"]
        for field in sensitive_fields:
            if field in sanitized:
                del sanitized[field]

        # Ensure all string values are stripped
        for key, value in sanitized.items():
            if isinstance(value, str):
                sanitized[key] = value.strip()

        return sanitized