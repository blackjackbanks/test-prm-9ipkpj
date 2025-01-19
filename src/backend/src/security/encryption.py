"""
Encryption module implementing AES-256-GCM encryption with secure key management
for protecting sensitive data in the COREos platform.

Version: 1.0.0
"""

import os
import base64  # version: 3.11+
from typing import Union, Optional
from cryptography.fernet import Fernet  # version: 41.0.0
from cryptography.hazmat.primitives.ciphers.algorithms import AES  # version: 41.0.0
from cryptography.hazmat.primitives.ciphers.modes import GCM  # version: 41.0.0
from cryptography.hazmat.primitives.ciphers import Cipher, aead
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidTag

from config.security import SECRET_KEY
from utils.exceptions import ValidationException

# Encryption constants
ENCRYPTION_KEY_LENGTH: int = 32  # 256 bits
GCM_NONCE_LENGTH: int = 12      # 96 bits
GCM_TAG_LENGTH: int = 16        # 128 bits

def generate_encryption_key() -> bytes:
    """
    Generate a cryptographically secure encryption key for AES-256-GCM.
    
    Returns:
        bytes: 32-byte encryption key with cryptographic randomness
        
    Raises:
        ValidationException: If generated key does not meet requirements
    """
    key = os.urandom(ENCRYPTION_KEY_LENGTH)
    
    # Validate key length
    if len(key) != ENCRYPTION_KEY_LENGTH:
        raise ValidationException(
            message="Generated key length invalid",
            error_code="crypto_001",
            details={"required_length": ENCRYPTION_KEY_LENGTH}
        )
    
    return key

def encrypt_data(data: Union[str, bytes], key: Optional[bytes] = None) -> str:
    """
    Encrypt data using AES-256-GCM with authentication tag and nonce.
    
    Args:
        data: Data to encrypt (string or bytes)
        key: Optional encryption key, uses default if not provided
        
    Returns:
        str: Base64 encoded encrypted data with nonce and authentication tag
        
    Raises:
        ValidationException: If encryption parameters are invalid
    """
    try:
        # Convert string to bytes if needed
        if isinstance(data, str):
            data = data.encode('utf-8')
            
        # Use provided key or derive from SECRET_KEY
        encryption_key = key or base64.urlsafe_b64decode(SECRET_KEY)
        if len(encryption_key) != ENCRYPTION_KEY_LENGTH:
            raise ValidationException(
                message="Invalid encryption key length",
                error_code="crypto_002"
            )
            
        # Generate random nonce
        nonce = os.urandom(GCM_NONCE_LENGTH)
        
        # Create cipher
        cipher = Cipher(
            AES(encryption_key),
            GCM(nonce),
            backend=default_backend()
        ).encryptor()
        
        # Encrypt data
        ciphertext = cipher.update(data) + cipher.finalize()
        
        # Combine nonce + ciphertext + tag
        encrypted_data = nonce + ciphertext + cipher.tag
        
        # Encode for transport
        return base64.b64encode(encrypted_data).decode('utf-8')
        
    except Exception as e:
        raise ValidationException(
            message="Encryption failed",
            error_code="crypto_003",
            details={"error": str(e)}
        )
    finally:
        # Clear sensitive data
        del encryption_key
        del data

def decrypt_data(encrypted_data: str, key: Optional[bytes] = None) -> str:
    """
    Decrypt data using AES-256-GCM with tag verification.
    
    Args:
        encrypted_data: Base64 encoded encrypted data
        key: Optional decryption key, uses default if not provided
        
    Returns:
        str: Decrypted data string
        
    Raises:
        ValidationException: If decryption fails or data is invalid
    """
    try:
        # Decode from Base64
        encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
        
        # Use provided key or derive from SECRET_KEY
        decryption_key = key or base64.urlsafe_b64decode(SECRET_KEY)
        if len(decryption_key) != ENCRYPTION_KEY_LENGTH:
            raise ValidationException(
                message="Invalid decryption key length",
                error_code="crypto_004"
            )
            
        # Extract components
        nonce = encrypted_bytes[:GCM_NONCE_LENGTH]
        tag = encrypted_bytes[-GCM_TAG_LENGTH:]
        ciphertext = encrypted_bytes[GCM_NONCE_LENGTH:-GCM_TAG_LENGTH]
        
        # Create cipher
        cipher = Cipher(
            AES(decryption_key),
            GCM(nonce, tag),
            backend=default_backend()
        ).decryptor()
        
        # Decrypt and verify
        decrypted_data = cipher.update(ciphertext) + cipher.finalize()
        
        return decrypted_data.decode('utf-8')
        
    except InvalidTag:
        raise ValidationException(
            message="Authentication failed - data may be corrupted",
            error_code="crypto_005"
        )
    except Exception as e:
        raise ValidationException(
            message="Decryption failed",
            error_code="crypto_006",
            details={"error": str(e)}
        )
    finally:
        # Clear sensitive data
        del decryption_key

class DataEncryption:
    """
    Class handling data encryption and decryption operations with key management.
    Provides an object-oriented interface for encryption operations.
    """
    
    def __init__(self, encryption_key: Optional[bytes] = None):
        """
        Initialize encryption with key and validate parameters.
        
        Args:
            encryption_key: Optional encryption key, generates new if not provided
        """
        self._encryption_key = encryption_key or generate_encryption_key()
        
        # Validate key
        if len(self._encryption_key) != ENCRYPTION_KEY_LENGTH:
            raise ValidationException(
                message="Invalid encryption key length",
                error_code="crypto_007"
            )
            
        # Initialize cipher
        self._cipher = AES(self._encryption_key)
    
    def encrypt(self, data: Union[str, bytes]) -> str:
        """
        Encrypt data using class encryption key with GCM mode.
        
        Args:
            data: Data to encrypt (string or bytes)
            
        Returns:
            str: Base64 encoded encrypted data
        """
        return encrypt_data(data, self._encryption_key)
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt data using class encryption key with authentication.
        
        Args:
            encrypted_data: Base64 encoded encrypted data
            
        Returns:
            str: Decrypted data string
        """
        return decrypt_data(encrypted_data, self._encryption_key)
    
    def rotate_key(self) -> bytes:
        """
        Generate and update encryption key with secure handling.
        
        Returns:
            bytes: New encryption key
        """
        try:
            new_key = generate_encryption_key()
            
            # Securely clear old key
            self._encryption_key = bytes([0] * ENCRYPTION_KEY_LENGTH)
            
            # Update key and cipher
            self._encryption_key = new_key
            self._cipher = AES(self._encryption_key)
            
            return new_key
            
        except Exception as e:
            raise ValidationException(
                message="Key rotation failed",
                error_code="crypto_008",
                details={"error": str(e)}
            )