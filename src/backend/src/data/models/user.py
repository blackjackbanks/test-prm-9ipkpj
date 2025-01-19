"""
SQLAlchemy model definition for User entity in the COREos platform.
Implements secure authentication, role-based access control, and GDPR-compliant data management.

Version: 1.0.0
"""

from datetime import datetime
from enum import Enum
import re
from typing import Dict, Optional
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

from config.database import Base
from data.models.organization import Organization

# Email validation regex pattern
EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

class UserRole(Enum):
    """User role enumeration for role-based access control."""
    SUPER_ADMIN = 'super_admin'
    ORG_ADMIN = 'org_admin'
    STANDARD_USER = 'standard_user'
    INTEGRATION_USER = 'integration_user'

class User(Base):
    """
    User model representing a system user with enhanced security and GDPR compliance.
    Implements comprehensive validation, audit trails, and secure data handling.
    """
    
    __tablename__ = 'users'
    
    # Primary columns with security considerations
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    role = Column(String(50), nullable=False)
    preferences = Column(JSON, nullable=False, default=dict)
    
    # Audit trail fields
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    
    # Performance optimization indexes
    __table_args__ = (
        Index('ix_users_email_is_active', 'email', 'is_active'),
        Index('ix_users_organization_role', 'organization_id', 'role'),
        {'postgresql_partition_by': 'RANGE (created_at)'}  # Time-based partitioning
    )
    
    def __init__(
        self,
        email: str,
        name: str,
        hashed_password: str,
        organization_id: UUID,
        role: UserRole,
        preferences: Optional[Dict] = None
    ) -> None:
        """
        Initialize a new User instance with secure defaults.
        
        Args:
            email: User's email address
            name: User's full name
            hashed_password: Pre-hashed password
            organization_id: Associated organization UUID
            role: UserRole enum value
            preferences: Optional user preferences
        """
        self.id = uuid4()
        self.email = self.validate_email(email)
        self.name = name
        self.hashed_password = hashed_password
        self.organization_id = organization_id
        self.role = self.validate_role(role).value
        self.preferences = preferences or {}
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.is_active = True
    
    @validates('email')
    def validate_email(self, email: str) -> str:
        """
        Validate email format using regex pattern.
        
        Args:
            email: Email address to validate
            
        Returns:
            Validated email address
            
        Raises:
            ValueError: If email format is invalid
        """
        if not email or not re.match(EMAIL_REGEX, email):
            raise ValueError("Invalid email format")
        return email.lower()
    
    @validates('role')
    def validate_role(self, role: UserRole) -> UserRole:
        """
        Validate user role against UserRole enum.
        
        Args:
            role: Role to validate
            
        Returns:
            Validated UserRole enum value
            
        Raises:
            ValueError: If role is invalid
        """
        if isinstance(role, str):
            try:
                role = UserRole(role)
            except ValueError:
                raise ValueError(f"Invalid role. Must be one of: {[r.value for r in UserRole]}")
        elif not isinstance(role, UserRole):
            raise ValueError("Role must be a UserRole enum value")
        return role
    
    def update_preferences(self, new_preferences: Dict) -> Dict:
        """
        Update user preferences with validation.
        
        Args:
            new_preferences: Dictionary containing new preferences
            
        Returns:
            Updated preferences dictionary
        """
        if not isinstance(new_preferences, dict):
            raise ValueError("Preferences must be a dictionary")
        
        # Merge preferences securely
        self.preferences = {
            **self.preferences,
            **new_preferences
        }
        
        # Update audit timestamp
        self.updated_at = datetime.utcnow()
        
        return self.preferences
    
    def to_dict(self, include_sensitive: bool = False) -> Dict:
        """
        Convert user model to GDPR-compliant dictionary.
        
        Args:
            include_sensitive: Whether to include sensitive data
            
        Returns:
            Dictionary containing user data
        """
        user_dict = {
            'id': str(self.id),
            'email': self.email if include_sensitive else self.email.split('@')[0] + '@...',
            'name': self.name,
            'organization_id': str(self.organization_id),
            'role': self.role,
            'preferences': self.preferences,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_active': self.is_active
        }
        
        if include_sensitive:
            user_dict.update({
                'last_login': self.last_login.isoformat() if self.last_login else None,
                'organization': {
                    'id': str(self.organization.id),
                    'name': self.organization.name
                } if self.organization else None
            })
        
        return user_dict
    
    def __repr__(self) -> str:
        """String representation of User instance."""
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"