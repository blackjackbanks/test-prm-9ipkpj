"""
SQLAlchemy model definition for Template entity representing business process templates
and workflow configurations in the COREos platform.

Version: 1.0.0
"""

from datetime import datetime, timezone
import re
from typing import Dict, Optional
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, UUID  # v2.0.0+
from sqlalchemy.orm import relationship  # v2.0.0+

from config.database import Base

class Template(Base):
    """
    SQLAlchemy model representing a business process template with version control,
    content management, and organization relationship.
    """
    __tablename__ = 'templates'

    # Primary key and relationships
    id = Column(UUID, primary_key=True, default=uuid4)
    org_id = Column(UUID, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    # Core template fields
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    content = Column(JSON, nullable=False)
    version = Column(String(50), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    organization = relationship("Organization", back_populates="templates")

    def __init__(
        self,
        name: str,
        category: str,
        content: Dict,
        version: str,
        org_id: UUID
    ) -> None:
        """
        Initialize a new Template instance with required fields and validation.

        Args:
            name: Template name (max 255 chars)
            category: Template category (max 100 chars)
            content: JSON content containing template configuration
            version: Semantic version string (e.g., "1.0.0")
            org_id: UUID of the owning organization
        
        Raises:
            ValueError: If validation fails for any field
        """
        # Validate name format
        if not re.match(r'^[a-zA-Z0-9\s\-_]{3,255}$', name):
            raise ValueError("Invalid template name format")

        # Validate category format
        if not re.match(r'^[a-zA-Z0-9\-_]{3,100}$', category):
            raise ValueError("Invalid category format")

        # Validate version format (semantic versioning)
        if not re.match(r'^\d+\.\d+\.\d+$', version):
            raise ValueError("Version must follow semantic versioning (e.g., 1.0.0)")

        # Validate content structure
        if not isinstance(content, dict) or not content:
            raise ValueError("Content must be a non-empty dictionary")

        # Set core fields
        self.id = uuid4()
        self.name = name
        self.category = category
        self.content = content
        self.version = version
        self.org_id = org_id

        # Set timestamps
        current_time = datetime.now(timezone.utc)
        self.created_at = current_time
        self.updated_at = current_time

    def update_content(self, new_content: Dict, new_version: str) -> Dict:
        """
        Update template content and version with validation.

        Args:
            new_content: Updated template configuration
            new_version: New semantic version string

        Returns:
            Dict containing updated template content with metadata

        Raises:
            ValueError: If validation fails for content or version
        """
        # Validate version format
        if not re.match(r'^\d+\.\d+\.\d+$', new_version):
            raise ValueError("Version must follow semantic versioning (e.g., 1.0.0)")

        # Validate content structure
        if not isinstance(new_content, dict) or not new_content:
            raise ValueError("Content must be a non-empty dictionary")

        # Update content and metadata
        self.content = new_content
        self.version = new_version
        self.updated_at = datetime.now(timezone.utc)

        # Return updated content with metadata
        return {
            "content": self.content,
            "version": self.version,
            "updated_at": self.updated_at.isoformat()
        }

    def to_dict(self) -> Dict:
        """
        Convert template model to dictionary with complete metadata.

        Returns:
            Dict containing complete template data with relationships
        """
        return {
            "id": str(self.id),
            "org_id": str(self.org_id),
            "name": self.name,
            "category": self.category,
            "content": self.content,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "organization": {
                "id": str(self.organization.id),
                "name": self.organization.name
            } if self.organization else None
        }

    def __repr__(self) -> str:
        """String representation of Template instance."""
        return f"<Template(id={self.id}, name='{self.name}', version='{self.version}')>"