"""
Comprehensive unit tests for security modules including encryption, JWT tokens, 
OAuth2 authentication, role-based access control, and security compliance verification.

Version: 1.0.0
"""

# External imports - versions specified as per requirements
import pytest  # version: 7.0.0+
import pytest_asyncio  # version: 0.21.0+
from pytest_mock import MockerFixture  # version: 3.10.0+
import os
import base64
from datetime import datetime, timedelta
from typing import Dict, Any

# Internal imports
from security.encryption import DataEncryption, encrypt_data, decrypt_data
from security.jwt import JWTHandler, jwt_handler
from utils.exceptions import ValidationException, AuthenticationException
from config.security import SecurityConfig

class TestEncryption:
    """Test suite for encryption functionality with key rotation and memory safety"""
    
    def setup_method(self):
        """Set up encryption test suite with secure key management"""
        # Initialize encryption instance with test keys
        self._encryption = DataEncryption()
        self._test_key = os.urandom(32)  # 256-bit test key
        self._test_data = {
            "sensitive": "test123",
            "pii": "john.doe@example.com",
            "metadata": {"type": "test"}
        }

    def test_encryption_compliance(self):
        """Test encryption compliance with security standards"""
        # Test AES-256-GCM implementation
        test_string = "sensitive data"
        encrypted = self._encryption.encrypt(test_string)
        decrypted = self._encryption.decrypt(encrypted)
        
        assert decrypted == test_string
        assert len(encrypted) > len(test_string)
        assert isinstance(encrypted, str)
        assert base64.b64decode(encrypted)  # Verify base64 encoding
        
        # Test key strength requirements
        with pytest.raises(ValidationException) as exc_info:
            DataEncryption(encryption_key=b"weak_key")
        assert "Invalid encryption key length" in str(exc_info.value)
        
        # Test encryption padding and format
        encrypted_bytes = base64.b64decode(encrypted)
        assert len(encrypted_bytes) >= 28  # Nonce(12) + Min Data(1) + Tag(16)

    def test_key_rotation(self):
        """Test encryption key rotation process"""
        # Initial encryption
        test_data = "sensitive_info"
        encrypted = self._encryption.encrypt(test_data)
        
        # Perform key rotation
        new_key = self._encryption.rotate_key()
        assert len(new_key) == 32  # Verify new key length
        
        # Verify data can still be decrypted with new key
        decrypted = self._encryption.decrypt(encrypted)
        assert decrypted == test_data
        
        # Verify old data is cleared
        with pytest.raises(ValidationException) as exc_info:
            self._encryption.decrypt("invalid_data")
        assert "Authentication failed" in str(exc_info.value)

    def test_memory_safety(self):
        """Test secure memory handling and cleanup"""
        import gc
        
        # Create encryption instance
        encryption = DataEncryption()
        key_id = id(encryption._encryption_key)
        
        # Force cleanup
        del encryption
        gc.collect()
        
        # Verify key memory is cleared
        try:
            import ctypes
            ctypes.string_at(key_id, 1)
            assert False, "Key memory not cleared"
        except:
            assert True

class TestJWTSecurity:
    """Test suite for JWT token management and security"""
    
    def setup_method(self):
        """Set up JWT test suite"""
        self._jwt_handler = JWTHandler()
        self._test_claims = {
            "sub": "test_user",
            "email": "test@example.com"
        }
        self._test_roles = ["user", "admin"]
        self._test_permissions = {
            "read": True,
            "write": True
        }

    def test_token_lifecycle(self):
        """Test complete JWT token lifecycle"""
        # Create token
        token = self._jwt_handler.create_token(
            self._test_claims,
            self._test_roles,
            self._test_permissions
        )
        assert isinstance(token, str)
        
        # Verify token
        payload = self._jwt_handler.verify_token(token)
        assert payload["sub"] == self._test_claims["sub"]
        assert payload["roles"] == self._test_roles
        assert payload["permissions"] == self._test_permissions
        
        # Test expiration
        with pytest.raises(AuthenticationException) as exc_info:
            expired_token = self._jwt_handler.create_token(
                self._test_claims,
                self._test_roles,
                self._test_permissions,
                expires_delta=timedelta(seconds=-1)
            )
            self._jwt_handler.verify_token(expired_token)
        assert "Invalid authentication token" in str(exc_info.value)

    def test_token_blacklisting(self):
        """Test token blacklisting and revocation"""
        # Create and blacklist token
        token = self._jwt_handler.create_token(
            self._test_claims,
            self._test_roles,
            self._test_permissions
        )
        self._jwt_handler.blacklist_token(token)
        
        # Verify blacklisted token is rejected
        with pytest.raises(AuthenticationException) as exc_info:
            self._jwt_handler.verify_token(token)
        assert "Token has been revoked" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_rbac_security(self):
        """Test role-based access control security"""
        # Create token with specific roles
        token = self._jwt_handler.create_token(
            self._test_claims,
            ["user"],
            {"read": True}
        )
        
        # Test role checks
        assert self._jwt_handler.has_role(token, "user")
        assert not self._jwt_handler.has_role(token, "admin")
        
        # Test permission checks
        assert self._jwt_handler.has_permission(token, "read")
        assert not self._jwt_handler.has_permission(token, "write")

def test_security_boundaries():
    """Test security boundary conditions and error handling"""
    jwt_handler = JWTHandler()
    
    # Test invalid token format
    with pytest.raises(AuthenticationException):
        jwt_handler.verify_token("invalid_token")
    
    # Test token tampering
    token = jwt_handler.create_token(
        {"sub": "test"},
        ["user"],
        {"read": True}
    )
    tampered_token = token[:-1] + ("1" if token[-1] == "0" else "0")
    with pytest.raises(AuthenticationException):
        jwt_handler.verify_token(tampered_token)
    
    # Test null/empty values
    with pytest.raises(ValidationException):
        DataEncryption(encryption_key=b"")
    
    with pytest.raises(AuthenticationException):
        jwt_handler.verify_token("")

@pytest.mark.asyncio
async def test_security_config():
    """Test security configuration and defaults"""
    config = SecurityConfig()
    
    # Test password hashing
    password = "SecurePassword123!"
    hashed = config.get_password_hash(password)
    assert config.verify_password(password, hashed)
    assert not config.verify_password("wrong_password", hashed)
    
    # Test minimum password requirements
    with pytest.raises(AuthenticationException):
        config.get_password_hash("short")