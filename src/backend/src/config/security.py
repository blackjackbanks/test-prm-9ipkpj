"""
Core security configuration module for COREos platform implementing enhanced security measures
and compliance features including password hashing, encryption, and key rotation.

Version: 1.0.0
"""

import secrets  # version: 3.11+
from passlib.context import CryptContext  # version: 1.7.4
from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # version: 41.0.0
from cryptography.hazmat.primitives import hashes  # version: 41.0.0
from cryptography.exceptions import InvalidKey  # version: 41.0.0
import logging  # version: 3.11+
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple, Any
from functools import wraps

from utils.exceptions import AuthenticationException

# Global security configuration constants
SECRET_KEY: str = secrets.token_urlsafe(32)
JWT_ALGORITHM: str = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
REFRESH_TOKEN_EXPIRE_DAYS: int = 7
PASSWORD_MIN_LENGTH: int = 12
PASSWORD_ROUNDS: int = 12
KEY_ROTATION_DAYS: int = 30
ENCRYPTION_KEY_LENGTH: int = 32

# Configure security logger
logger = logging.getLogger("security")

def periodic_task(days: int):
    """Decorator for periodic tasks like key rotation"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            instance = args[0]
            if (datetime.utcnow() - instance._last_rotation).days >= days:
                return func(*args, **kwargs)
        return wrapper
    return decorator

class SecurityConfig:
    """
    Enhanced security configuration class managing cryptographic settings and key rotation
    with comprehensive logging and security controls.
    """
    
    def __init__(self) -> None:
        """Initialize security configuration with enhanced settings"""
        # Initialize password hashing context
        self._pwd_context = CryptContext(
            schemes=["bcrypt"],
            default="bcrypt",
            bcrypt__rounds=PASSWORD_ROUNDS,
            deprecated="auto"
        )
        
        # Initialize JWT settings
        self._algorithm = JWT_ALGORITHM
        self._secret_key = SECRET_KEY
        
        # Initialize encryption keys
        self._encryption_keys: Dict[str, bytes] = {}
        self._active_key_id: str = self._generate_key_id()
        self._encryption_keys[self._active_key_id] = self._generate_encryption_key()
        
        # Initialize key rotation tracking
        self._last_rotation = datetime.utcnow()
        
        logger.info("Security configuration initialized successfully")

    def _generate_key_id(self) -> str:
        """Generate unique key identifier"""
        return secrets.token_hex(8)

    def _generate_encryption_key(self) -> bytes:
        """Generate cryptographically secure encryption key"""
        return secrets.token_bytes(ENCRYPTION_KEY_LENGTH)

    def get_password_hash(self, password: str) -> str:
        """
        Hash password using configured context with security logging
        
        Args:
            password: Plain text password to hash
            
        Returns:
            str: Securely hashed password
            
        Raises:
            AuthenticationException: If password doesn't meet complexity requirements
        """
        if len(password) < PASSWORD_MIN_LENGTH:
            raise AuthenticationException(
                message="Password does not meet minimum length requirement",
                error_code="auth_004"
            )
        
        hashed = self._pwd_context.hash(password)
        logger.debug("Password hashed successfully")
        return hashed

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify password against hash with timing attack protection
        
        Args:
            plain_password: Password to verify
            hashed_password: Stored hash to verify against
            
        Returns:
            bool: True if password matches, False otherwise
        """
        try:
            result = self._pwd_context.verify(plain_password, hashed_password)
            logger.debug("Password verification completed")
            return result
        except Exception as e:
            logger.warning(f"Password verification failed: {str(e)}")
            return False

    def encrypt_data(self, data: bytes, key_id: Optional[str] = None) -> Tuple[bytes, bytes]:
        """
        Encrypt sensitive data using AES-256-GCM
        
        Args:
            data: Data to encrypt
            key_id: Optional specific key ID to use
            
        Returns:
            Tuple[bytes, bytes]: Encrypted data and nonce
        """
        key_id = key_id or self._active_key_id
        if key_id not in self._encryption_keys:
            raise ValueError("Invalid encryption key ID")
        
        key = self._encryption_keys[key_id]
        aesgcm = AESGCM(key)
        nonce = secrets.token_bytes(12)
        
        encrypted = aesgcm.encrypt(nonce, data, None)
        logger.debug(f"Data encrypted successfully using key {key_id}")
        
        return encrypted, nonce

    def decrypt_data(self, encrypted_data: bytes, nonce: bytes, key_id: str) -> bytes:
        """
        Decrypt data using AES-256-GCM
        
        Args:
            encrypted_data: Data to decrypt
            nonce: Nonce used for encryption
            key_id: Key ID used for encryption
            
        Returns:
            bytes: Decrypted data
            
        Raises:
            ValueError: If key ID is invalid
            InvalidKey: If decryption fails
        """
        if key_id not in self._encryption_keys:
            raise ValueError("Invalid encryption key ID")
        
        key = self._encryption_keys[key_id]
        aesgcm = AESGCM(key)
        
        try:
            decrypted = aesgcm.decrypt(nonce, encrypted_data, None)
            logger.debug(f"Data decrypted successfully using key {key_id}")
            return decrypted
        except InvalidKey as e:
            logger.error(f"Decryption failed with key {key_id}: {str(e)}")
            raise

    @periodic_task(days=KEY_ROTATION_DAYS)
    def rotate_encryption_keys(self) -> Dict[str, str]:
        """
        Rotate encryption keys securely
        
        Returns:
            Dict[str, str]: New encryption key IDs and their creation timestamps
        """
        new_key_id = self._generate_key_id()
        self._encryption_keys[new_key_id] = self._generate_encryption_key()
        self._active_key_id = new_key_id
        self._last_rotation = datetime.utcnow()
        
        # Remove old keys beyond retention period
        retention_date = datetime.utcnow() - timedelta(days=KEY_ROTATION_DAYS * 2)
        self._encryption_keys = {
            k: v for k, v in self._encryption_keys.items()
            if k == self._active_key_id or k == self._previous_key_id
        }
        
        logger.info(f"Encryption keys rotated successfully, new active key: {new_key_id}")
        return {
            "active_key_id": new_key_id,
            "rotation_time": self._last_rotation.isoformat()
        }

# Initialize singleton instance
security_config = SecurityConfig()

# Expose key functions
get_password_hash = security_config.get_password_hash
verify_password = security_config.verify_password