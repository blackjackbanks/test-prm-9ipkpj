"""
Enhanced authorization module implementing role-based access control (RBAC) and permission
management with advanced security features, audit logging, and compliance controls.

Version: 1.0.0
"""

from enum import Enum, unique  # version: 3.11+
from typing import List, Dict, Optional, Callable  # version: 3.11+
from fastapi import Depends, Security  # version: 0.100+
from cachetools import Cache, TTLCache  # version: 5.0+
import logging  # version: 3.11+

from security.jwt import JWTHandler
from utils.exceptions import AuthenticationException

# Configure logger
logger = logging.getLogger("authorization")

@unique
class UserRole(Enum):
    """User role hierarchy with unique value validation"""
    SUPER_ADMIN = 'super_admin'
    ORG_ADMIN = 'org_admin'
    STANDARD_USER = 'standard_user'
    INTEGRATION_USER = 'integration_user'

@unique
class Permission(Enum):
    """Granular permissions with unique value validation"""
    READ_DATA = 'read_data'
    WRITE_DATA = 'write_data'
    MANAGE_TEMPLATES = 'manage_templates'
    CONFIGURE_INTEGRATIONS = 'configure_integrations'
    MANAGE_USERS = 'manage_users'

class RBACHandler:
    """Enhanced RBAC handler with caching, audit logging, and compliance features"""
    
    def __init__(self) -> None:
        """Initialize RBAC handler with enhanced security features"""
        self._jwt_handler = JWTHandler()
        self._logger = logging.getLogger("rbac_security")
        
        # Initialize permission cache with 5-minute TTL
        self._permission_cache = TTLCache(maxsize=1000, ttl=300)
        
        # Define role permissions mapping
        self._role_permissions = {
            UserRole.SUPER_ADMIN.value: [p.value for p in Permission],
            UserRole.ORG_ADMIN.value: [
                Permission.READ_DATA.value,
                Permission.WRITE_DATA.value,
                Permission.MANAGE_TEMPLATES.value,
                Permission.CONFIGURE_INTEGRATIONS.value,
                Permission.MANAGE_USERS.value
            ],
            UserRole.STANDARD_USER.value: [
                Permission.READ_DATA.value,
                Permission.WRITE_DATA.value,
                Permission.MANAGE_TEMPLATES.value
            ],
            UserRole.INTEGRATION_USER.value: [
                Permission.READ_DATA.value
            ]
        }
        
        # Define role hierarchy
        self._role_hierarchy = {
            UserRole.SUPER_ADMIN.value: [r.value for r in UserRole],
            UserRole.ORG_ADMIN.value: [
                UserRole.ORG_ADMIN.value,
                UserRole.STANDARD_USER.value,
                UserRole.INTEGRATION_USER.value
            ],
            UserRole.STANDARD_USER.value: [
                UserRole.STANDARD_USER.value,
                UserRole.INTEGRATION_USER.value
            ],
            UserRole.INTEGRATION_USER.value: [
                UserRole.INTEGRATION_USER.value
            ]
        }
        
        self._logger.info("RBAC Handler initialized with enhanced security features")

    def verify_permission(self, token: str, required_permission: str) -> bool:
        """
        Verify permission with caching and audit logging
        
        Args:
            token: JWT token to verify
            required_permission: Permission to check
            
        Returns:
            bool: True if permission is granted
        """
        cache_key = f"{token}:{required_permission}"
        
        # Check cache first
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key]
            
        try:
            # Decode and validate token
            payload = self._jwt_handler.verify_token(token)
            user_role = payload.get("role")
            
            if not user_role:
                raise AuthenticationException(
                    message="Invalid role in token",
                    error_code="auth_002"
                )
                
            # Get inherited roles
            inherited_roles = self._role_hierarchy.get(user_role, [])
            
            # Check permission for all applicable roles
            has_permission = False
            for role in inherited_roles:
                if required_permission in self._role_permissions.get(role, []):
                    has_permission = True
                    break
                    
            # Update cache
            self._permission_cache[cache_key] = has_permission
            
            # Log permission check
            self._logger.debug(
                f"Permission check: {required_permission} for role {user_role}",
                extra={
                    "user_id": payload.get("sub"),
                    "role": user_role,
                    "permission": required_permission,
                    "granted": has_permission
                }
            )
            
            return has_permission
            
        except Exception as e:
            self._logger.error(f"Permission verification failed: {str(e)}")
            return False

    def get_user_permissions(self, role: str) -> List[str]:
        """
        Get permissions with inheritance and caching
        
        Args:
            role: User role to get permissions for
            
        Returns:
            List[str]: List of granted permissions
        """
        # Check cache
        if role in self._permission_cache:
            return self._permission_cache[role]
            
        try:
            if role not in self._role_hierarchy:
                raise ValueError(f"Invalid role: {role}")
                
            # Get inherited roles
            inherited_roles = self._role_hierarchy[role]
            
            # Combine permissions from all inherited roles
            permissions = set()
            for inherited_role in inherited_roles:
                role_permissions = self._role_permissions.get(inherited_role, [])
                permissions.update(role_permissions)
                
            # Convert to sorted list
            permission_list = sorted(list(permissions))
            
            # Update cache
            self._permission_cache[role] = permission_list
            
            # Log permission access
            self._logger.debug(
                f"Retrieved permissions for role {role}",
                extra={"role": role, "permissions": permission_list}
            )
            
            return permission_list
            
        except Exception as e:
            self._logger.error(f"Failed to get permissions: {str(e)}")
            return []

def require_permission(required_permission: str) -> Callable:
    """
    Enhanced permission requirement decorator with security features
    
    Args:
        required_permission: Permission required for access
        
    Returns:
        Callable: Decorated endpoint function
    """
    rbac_handler = RBACHandler()
    
    def permission_dependency(token: str = Security(JWTHandler().verify_token)):
        if not rbac_handler.verify_permission(token, required_permission):
            raise AuthenticationException(
                message="Insufficient permissions",
                error_code="auth_003"
            )
        return token
        
    return permission_dependency

def get_current_user_role(token: str) -> str:
    """
    Extract and validate user role from JWT with security checks
    
    Args:
        token: JWT token to extract role from
        
    Returns:
        str: Validated user role
        
    Raises:
        AuthenticationException: If role is invalid or missing
    """
    try:
        payload = JWTHandler().verify_token(token)
        role = payload.get("role")
        
        if not role or role not in [r.value for r in UserRole]:
            raise AuthenticationException(
                message="Invalid role in token",
                error_code="auth_002"
            )
            
        logger.debug(f"Extracted role {role} from token")
        return role
        
    except Exception as e:
        logger.error(f"Role extraction failed: {str(e)}")
        raise AuthenticationException(
            message="Failed to extract user role",
            error_code="auth_002"
        )