"""
Unit tests for SQLAlchemy data models in COREos platform.
Tests model attributes, relationships, methods, GDPR compliance, and audit trails.

Version: 1.0.0
"""

import pytest
import pytest_asyncio  # v0.21.0+
from uuid import UUID
from datetime import datetime
from http import HTTPStatus
from email_validator import validate_email  # v2.0.0+

from data.models.user import User, UserRole
from data.models.organization import Organization

@pytest.mark.asyncio
async def test_user_model_creation(db_session):
    """Test User model instantiation with validation and GDPR compliance."""
    # Prepare test data
    test_org = Organization(
        name="Test Organization",
        industry="technology",
        settings={"feature_flags": {"ai_enabled": True}}
    )
    
    test_user = User(
        email="test@example.com",
        name="Test User",
        hashed_password="hashed_password_value",
        organization_id=test_org.id,
        role=UserRole.STANDARD_USER,
        preferences={"theme": "dark", "notifications": True}
    )
    
    # Test UUID generation
    assert isinstance(test_user.id, UUID)
    
    # Test email validation
    assert test_user.email == "test@example.com"
    with pytest.raises(ValueError, match="Invalid email format"):
        test_user.validate_email("invalid-email")
    
    # Test role validation
    assert test_user.role == UserRole.STANDARD_USER.value
    with pytest.raises(ValueError):
        test_user.validate_role("invalid_role")
    
    # Test audit trail fields
    assert isinstance(test_user.created_at, datetime)
    assert isinstance(test_user.updated_at, datetime)
    assert test_user.is_active is True
    
    # Test GDPR compliance in to_dict output
    user_dict = test_user.to_dict(include_sensitive=False)
    assert "@" not in user_dict["email"]
    assert "hashed_password" not in user_dict
    
    # Test full data access with sensitive flag
    sensitive_dict = test_user.to_dict(include_sensitive=True)
    assert sensitive_dict["email"] == "test@example.com"
    assert "organization_id" in sensitive_dict

@pytest.mark.asyncio
async def test_user_preferences_update(db_session):
    """Test User preferences update with validation and audit trail."""
    test_user = User(
        email="preferences@example.com",
        name="Preferences Test",
        hashed_password="hashed_password_value",
        organization_id=UUID('12345678-1234-5678-1234-567812345678'),
        role=UserRole.STANDARD_USER
    )
    
    # Test initial preferences
    assert isinstance(test_user.preferences, dict)
    
    # Test preferences update
    new_preferences = {
        "theme": "light",
        "language": "en",
        "notifications": {
            "email": True,
            "push": False
        }
    }
    
    initial_updated_at = test_user.updated_at
    updated_preferences = test_user.update_preferences(new_preferences)
    
    # Verify preference updates
    assert updated_preferences["theme"] == "light"
    assert updated_preferences["notifications"]["email"] is True
    
    # Verify audit trail update
    assert test_user.updated_at > initial_updated_at
    
    # Test invalid preferences update
    with pytest.raises(ValueError, match="Preferences must be a dictionary"):
        test_user.update_preferences(["invalid"])

@pytest.mark.asyncio
async def test_organization_model_creation(db_session):
    """Test Organization model with industry validation and audit trail."""
    # Test valid organization creation
    test_org = Organization(
        name="Test Corp",
        industry="technology",
        settings={"billing_type": "monthly"}
    )
    
    assert isinstance(test_org.id, UUID)
    assert test_org.name == "Test Corp"
    assert test_org.industry == "technology"
    
    # Test name validation
    with pytest.raises(ValueError):
        Organization(name="", industry="technology")
    
    with pytest.raises(ValueError):
        Organization(name="A" * 256, industry="technology")
    
    # Test industry validation
    with pytest.raises(ValueError):
        Organization(name="Test Corp", industry="invalid_industry")
    
    # Test audit trail
    assert isinstance(test_org.created_at, datetime)
    assert isinstance(test_org.updated_at, datetime)
    assert test_org.is_active is True
    
    # Test soft delete
    assert test_org.soft_delete() is True
    assert test_org.is_active is False
    assert test_org.updated_at > test_org.created_at

@pytest.mark.asyncio
async def test_organization_settings_update(db_session):
    """Test Organization settings update with validation and audit trail."""
    test_org = Organization(
        name="Settings Test Org",
        industry="finance",
        settings={"initial": "value"}
    )
    
    # Test settings update
    new_settings = {
        "feature_flags": {
            "advanced_analytics": True,
            "ai_assistant": False
        },
        "compliance": {
            "gdpr": True,
            "hipaa": False
        }
    }
    
    initial_updated_at = test_org.updated_at
    updated_settings = test_org.update_settings(new_settings)
    
    # Verify settings updates
    assert updated_settings["feature_flags"]["advanced_analytics"] is True
    assert updated_settings["compliance"]["gdpr"] is True
    
    # Verify audit trail update
    assert test_org.updated_at > initial_updated_at
    
    # Test invalid settings update
    with pytest.raises(ValueError, match="Settings must be a dictionary"):
        test_org.update_settings(["invalid"])

@pytest.mark.asyncio
async def test_user_organization_relationship(db_session):
    """Test User-Organization relationship with constraints."""
    # Create test organization
    test_org = Organization(
        name="Relationship Test Org",
        industry="technology",
        settings={}
    )
    
    # Create test users
    admin_user = User(
        email="admin@test.com",
        name="Admin User",
        hashed_password="hashed_password_value",
        organization_id=test_org.id,
        role=UserRole.ORG_ADMIN
    )
    
    standard_user = User(
        email="user@test.com",
        name="Standard User",
        hashed_password="hashed_password_value",
        organization_id=test_org.id,
        role=UserRole.STANDARD_USER
    )
    
    # Test bidirectional relationship
    test_org.users.append(admin_user)
    test_org.users.append(standard_user)
    
    assert len(test_org.users) == 2
    assert admin_user.organization.id == test_org.id
    assert standard_user.organization.id == test_org.id
    
    # Test organization dict with relationships
    org_dict = test_org.to_dict(include_relationships=True)
    assert org_dict["users_count"] == 2
    
    # Test cascade delete
    test_org.soft_delete()
    assert not test_org.is_active
    assert test_org.updated_at > test_org.created_at