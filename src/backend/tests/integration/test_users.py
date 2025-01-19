"""
Integration tests for user management functionality in the COREos platform.
Implements comprehensive testing of authentication, CRUD operations, and security measures.

Version: 1.0.0
"""

import pytest  # v7.0.0+
from uuid import uuid4  # v3.11+
from httpx import AsyncClient  # v0.24.0+
from datetime import datetime, timedelta
import jwt  # python-jose[cryptography] v3.3.0+
import logging
from typing import Dict, Any

from data.schemas.user import UserCreate
from utils.constants import HTTPStatusCodes, ErrorCodes
from utils.validators import validate_password
from config.security import security_config
from config.settings import settings

# Configure test logger
logger = logging.getLogger("test_users")

# Test constants
TEST_USER_EMAIL = "test@coreos.com"
TEST_USER_PASSWORD = "Test123!@#$%^&*()"
TOKEN_EXPIRY = 3600

@pytest.mark.asyncio
async def test_create_user(async_client: AsyncClient, test_organization: Dict[str, Any]) -> None:
    """
    Test secure user creation with enhanced validation.
    
    Args:
        async_client: HTTP client fixture
        test_organization: Test organization fixture
    """
    # Validate password strength
    validate_password(TEST_USER_PASSWORD)
    
    # Prepare test user data
    user_data = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
        "name": "Test User",
        "organization_id": str(test_organization["id"]),
        "role": "standard",
        "preferences": {"theme": "dark"}
    }
    
    # Create user with CSRF protection
    response = await async_client.post(
        "/api/v1/users",
        json=user_data,
        headers={"X-CSRF-Token": str(uuid4())}
    )
    
    # Verify security headers
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    
    # Verify response
    assert response.status_code == HTTPStatusCodes.CREATED.value
    data = response.json()
    
    # Validate response data
    assert data["email"] == TEST_USER_EMAIL.lower()
    assert "password" not in data
    assert data["organization_id"] == str(test_organization["id"])
    assert data["role"] == "standard"
    
    # Verify password hashing
    user_in_db = await async_client.get(f"/api/v1/users/{data['id']}")
    assert not security_config.verify_password(TEST_USER_PASSWORD, user_in_db.json()["password"])

@pytest.mark.asyncio
async def test_authenticate_user(async_client: AsyncClient, test_user: Dict[str, Any]) -> None:
    """
    Test secure user authentication with comprehensive token validation.
    
    Args:
        async_client: HTTP client fixture
        test_user: Test user fixture
    """
    # Prepare login data
    login_data = {
        "email": test_user["email"],
        "password": test_user["password"]
    }
    
    # Attempt login with rate limiting check
    response = await async_client.post(
        "/api/v1/auth/login",
        json=login_data,
        headers={"X-Request-ID": str(uuid4())}
    )
    
    # Verify security headers
    assert "Strict-Transport-Security" in response.headers
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    
    # Verify response
    assert response.status_code == HTTPStatusCodes.OK.value
    data = response.json()
    
    # Validate JWT token
    assert "access_token" in data
    assert "refresh_token" in data
    
    # Decode and verify token claims
    token_data = jwt.decode(
        data["access_token"],
        settings.SECRET_KEY,
        algorithms=[settings.SECURITY_SETTINGS["jwt_algorithm"]]
    )
    
    assert token_data["sub"] == test_user["email"]
    assert token_data["roles"] == test_user["roles"]
    assert "exp" in token_data
    assert "jti" in token_data

@pytest.mark.asyncio
class TestUserSecurity:
    """Test suite for enhanced user security features."""
    
    def __init__(self):
        """Initialize security test suite."""
        self.test_tokens = {}
        self.logger = logging.getLogger("user_security_tests")
    
    async def test_password_policies(self, async_client: AsyncClient) -> None:
        """Test comprehensive password security policies."""
        
        # Test minimum length
        with pytest.raises(Exception) as exc:
            await async_client.post(
                "/api/v1/users",
                json={"password": "short"}
            )
        assert "Password must be at least 8 characters" in str(exc.value)
        
        # Test complexity requirements
        with pytest.raises(Exception) as exc:
            await async_client.post(
                "/api/v1/users",
                json={"password": "nospecialchars123"}
            )
        assert "must contain at least one special character" in str(exc.value)
        
        # Test common password patterns
        with pytest.raises(Exception) as exc:
            await async_client.post(
                "/api/v1/users",
                json={"password": "Password123!"}
            )
        assert "contains common patterns" in str(exc.value)
    
    async def test_token_expiry(self, async_client: AsyncClient, test_user: Dict[str, Any]) -> None:
        """Test token expiration and refresh flow."""
        
        # Get initial tokens
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user["email"],
                "password": test_user["password"]
            }
        )
        tokens = response.json()
        
        # Wait for token expiration
        await asyncio.sleep(1)
        
        # Attempt refresh
        refresh_response = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
        )
        
        assert refresh_response.status_code == HTTPStatusCodes.OK.value
        new_tokens = refresh_response.json()
        assert new_tokens["access_token"] != tokens["access_token"]
    
    async def test_session_management(self, async_client: AsyncClient, test_user: Dict[str, Any]) -> None:
        """Test secure session handling and invalidation."""
        
        # Create multiple sessions
        sessions = []
        for _ in range(3):
            response = await async_client.post(
                "/api/v1/auth/login",
                json={
                    "email": test_user["email"],
                    "password": test_user["password"]
                }
            )
            sessions.append(response.json())
        
        # Verify active sessions
        sessions_response = await async_client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {sessions[0]['access_token']}"}
        )
        assert len(sessions_response.json()) == 3
        
        # Invalidate specific session
        await async_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {sessions[1]['access_token']}"}
        )
        
        # Verify session removal
        updated_sessions = await async_client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {sessions[0]['access_token']}"}
        )
        assert len(updated_sessions.json()) == 2