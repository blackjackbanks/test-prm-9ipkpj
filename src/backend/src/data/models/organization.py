"""
SQLAlchemy model definition for Organization entity in the COREos platform.
Implements production-ready features including audit trails, data validation,
and performance optimizations.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, JSON, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

from config.database import Base

class Organization(Base):
    """
    Organization model representing a business entity in the COREos platform.
    Implements comprehensive data validation, audit trails, and relationship management.
    """
    
    __tablename__ = 'organizations'
    
    # Primary columns
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    industry = Column(String(100), nullable=False)
    settings = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    integrations = relationship("Integration", back_populates="organization", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="organization", cascade="all, delete-orphan")
    
    # Indexes for performance optimization
    __table_args__ = (
        Index('ix_organization_name', 'name'),
        Index('ix_organization_industry', 'industry'),
        Index('ix_organization_is_active', 'is_active'),
        {'postgresql_partition_by': 'LIST (industry)'}  # Partitioning for large datasets
    )
    
    def __init__(self, name: str, industry: str, settings: Optional[Dict] = None) -> None:
        """
        Initialize a new Organization instance with audit trail.
        
        Args:
            name: Organization name
            industry: Industry classification
            settings: Optional configuration dictionary
        """
        self.id = uuid4()
        self.name = name
        self.industry = industry
        self.settings = settings or {}
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.is_active = True
    
    @validates('name')
    def validate_name(self, key: str, name: str) -> str:
        """
        Validate organization name.
        
        Args:
            key: Field name being validated
            name: Organization name to validate
            
        Returns:
            Validated name string
            
        Raises:
            ValueError: If name is invalid
        """
        if not name or len(name.strip()) < 2:
            raise ValueError("Organization name must be at least 2 characters long")
        if len(name) > 255:
            raise ValueError("Organization name must not exceed 255 characters")
        return name.strip()
    
    @validates('industry')
    def validate_industry(self, key: str, industry: str) -> str:
        """
        Validate industry classification.
        
        Args:
            key: Field name being validated
            industry: Industry to validate
            
        Returns:
            Validated industry string
            
        Raises:
            ValueError: If industry is invalid
        """
        valid_industries = {
            'technology', 'finance', 'healthcare', 'retail', 
            'manufacturing', 'services', 'education', 'other'
        }
        if not industry or industry.lower() not in valid_industries:
            raise ValueError(f"Industry must be one of: {', '.join(valid_industries)}")
        return industry.lower()
    
    def update_settings(self, new_settings: Dict) -> Dict:
        """
        Update organization settings with validation.
        
        Args:
            new_settings: Dictionary containing new settings
            
        Returns:
            Updated settings dictionary
        """
        # Validate settings structure
        if not isinstance(new_settings, dict):
            raise ValueError("Settings must be a dictionary")
            
        # Deep merge settings
        self.settings = {
            **self.settings,
            **new_settings
        }
        
        # Update audit timestamp
        self.updated_at = datetime.utcnow()
        
        return self.settings
    
    def soft_delete(self) -> bool:
        """
        Perform soft deletion of organization.
        
        Returns:
            bool: True if successful
        """
        self.is_active = False
        self.updated_at = datetime.utcnow()
        return True
    
    def to_dict(self, include_relationships: bool = False) -> Dict:
        """
        Convert organization model to dictionary representation.
        
        Args:
            include_relationships: Whether to include related entities
            
        Returns:
            Dictionary containing organization data
        """
        org_dict = {
            'id': str(self.id),
            'name': self.name,
            'industry': self.industry,
            'settings': self.settings,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_active': self.is_active
        }
        
        if include_relationships:
            org_dict.update({
                'users_count': len(self.users),
                'integrations_count': len(self.integrations),
                'templates_count': len(self.templates)
            })
        
        return org_dict
    
    def __repr__(self) -> str:
        """String representation of Organization instance."""
        return f"<Organization(id={self.id}, name='{self.name}', industry='{self.industry}')>"