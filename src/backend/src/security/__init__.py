"""
Core security module initialization file for COREos platform providing enhanced authentication,
authorization, encryption and JWT functionality with comprehensive security monitoring.

Version: 1.0.0
"""

from security.authentication import AuthenticationManager
from security.authorization import RBACHandler
from security.encryption import DataEncryption

# Version of the security module
__version__ = '1.0.0'

# Export core security classes with enhanced functionality
__all__ = [
    'AuthenticationManager',
    'RBACHandler', 
    'DataEncryption',
    'SecurityConfig'
]

class SecurityConfig:
    """
    Security configuration management with enhanced security controls and monitoring.
    Provides centralized security settings validation and updates.
    """
    
    def __init__(self):
        """Initialize security configuration with default secure settings"""
        # Initialize core security components
        self._auth_manager = AuthenticationManager({
            'rate_limit': 100,
            'redis_host': 'localhost',
            'redis_port': 6379
        })
        self._rbac_handler = RBACHandler()
        self._encryption = DataEncryption()
        
        # Track security configuration state
        self._initialized = True
        self._last_validation = None
        self._security_settings = {}

    def validate_config(self) -> bool:
        """
        Validate security configuration against security requirements.
        
        Returns:
            bool: True if configuration is valid
        """
        try:
            # Validate authentication settings
            auth_valid = self._auth_manager is not None
            
            # Validate RBAC configuration  
            rbac_valid = self._rbac_handler is not None
            
            # Validate encryption setup
            encryption_valid = self._encryption is not None
            
            # All components must be valid
            return all([
                auth_valid,
                rbac_valid, 
                encryption_valid,
                self._initialized
            ])
            
        except Exception:
            return False

    def update_security_settings(self, settings: dict) -> bool:
        """
        Update security configuration with new settings.
        
        Args:
            settings: New security settings to apply
            
        Returns:
            bool: True if update successful
        """
        try:
            # Update authentication settings if provided
            if 'authentication' in settings:
                self._auth_manager = AuthenticationManager(
                    settings['authentication']
                )
                
            # Update RBAC settings if provided    
            if 'rbac' in settings:
                self._rbac_handler = RBACHandler()
                
            # Update encryption settings if provided
            if 'encryption' in settings:
                self._encryption = DataEncryption(
                    settings['encryption'].get('key')
                )
                
            # Validate new configuration
            if not self.validate_config():
                raise ValueError("Invalid security configuration")
                
            # Store settings
            self._security_settings.update(settings)
            return True
            
        except Exception:
            return False

# Initialize global security configuration
security_config = SecurityConfig()

# Export key functions with enhanced security
authenticate = security_config._auth_manager.authenticate_user
verify_permission = security_config._rbac_handler.verify_permission
encrypt = security_config._encryption.encrypt
decrypt = security_config._encryption.decrypt
validate_security = security_config.validate_config
update_security = security_config.update_security_settings