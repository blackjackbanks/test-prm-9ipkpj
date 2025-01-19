"""
Core configuration module for COREos backend application.
Manages environment-specific settings, security configurations, and performance parameters.

Version: 1.0.0
"""

from functools import lru_cache
from typing import Dict, List, Optional
import logging
from pathlib import Path

from pydantic_settings import BaseSettings  # v2.0.0+
from pydantic import Field, validator  # v2.0.0+
from dotenv import load_dotenv  # v1.0.0+
from cryptography.fernet import Fernet  # v41.0.0+

from utils.constants import API_VERSION, RATE_LIMIT_DEFAULT, RATE_LIMIT_BURST

# Load environment variables
load_dotenv(Path(__file__).parent.parent / ".env")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """
    Enhanced settings management with security, performance, and validation features.
    Implements SOC 2 Type II compliant configuration handling.
    """
    
    # Core Application Settings
    ENV_STATE: str = Field(default="development", env="APP_ENV")
    DEBUG: bool = Field(default=False, env="DEBUG")
    API_VERSION: str = Field(default=API_VERSION)
    SECRET_KEY: str = Field(default=None, env="SECRET_KEY")
    PROJECT_NAME: str = Field(default="COREos", env="PROJECT_NAME")
    VERSION: str = Field(default="1.0.0", env="APP_VERSION")
    CONFIG_VERSION: str = Field(default="1.0.0", env="CONFIG_VERSION")
    
    # Database Configuration with Connection Pooling
    DATABASE_SETTINGS: Dict = Field(default_factory=dict)
    
    # Redis Cache Configuration
    CACHE_SETTINGS: Dict = Field(default_factory=dict)
    
    # Security Settings
    CORS_ORIGINS: List[str] = Field(default_factory=list)
    SECURITY_SETTINGS: Dict = Field(default_factory=dict)
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    
    # Rate Limiting Configuration
    RATE_LIMITS: Dict = Field(
        default={
            "default": RATE_LIMIT_DEFAULT,
            "burst": RATE_LIMIT_BURST
        }
    )

    def __init__(self, **kwargs):
        """Initialize settings with enhanced validation and security."""
        super().__init__(**kwargs)
        self._init_encryption()
        self._load_environment_config()
        self._setup_logging()
        logger.info(f"Initialized settings for environment: {self.ENV_STATE}")

    def _init_encryption(self):
        """Initialize encryption for sensitive configuration values."""
        self._cipher = Fernet(self.SECRET_KEY.encode()) if self.SECRET_KEY else None
        
    def _load_environment_config(self):
        """Load environment-specific configurations."""
        self.DATABASE_SETTINGS = self.get_database_settings()
        self.CACHE_SETTINGS = self.get_cache_settings()
        self.CORS_ORIGINS = self.get_cors_origins()
        self.SECURITY_SETTINGS = self.get_security_settings()

    def _setup_logging(self):
        """Configure logging based on environment."""
        logging.getLogger().setLevel(getattr(logging, self.LOG_LEVEL))

    def get_database_settings(self) -> Dict:
        """
        Get optimized database configuration with connection pooling.
        Implements security best practices and performance optimization.
        """
        db_url = self._get_db_url()
        return {
            "url": db_url,
            "pool_size": 20 if self.ENV_STATE == "production" else 5,
            "max_overflow": 10,
            "pool_timeout": 30,
            "pool_recycle": 1800,
            "pool_pre_ping": True,
            "ssl_mode": "verify-full" if self.ENV_STATE == "production" else "prefer",
            "connect_timeout": 10,
            "max_retries": 3,
            "retry_interval": 1
        }

    def get_cache_settings(self) -> Dict:
        """
        Get performance-optimized cache configuration.
        Implements Redis best practices for high availability.
        """
        return {
            "url": self._get_cache_url(),
            "pool_size": 50 if self.ENV_STATE == "production" else 10,
            "pool_timeout": 30,
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "retry_on_timeout": True,
            "max_retries": 3,
            "ssl": self.ENV_STATE == "production",
            "health_check_interval": 30
        }

    def get_cors_origins(self) -> List[str]:
        """
        Get validated CORS origins with security checks.
        Implements origin validation and security controls.
        """
        origins = self._get_origins_list()
        validated_origins = []
        for origin in origins:
            if self._validate_origin(origin):
                validated_origins.append(origin)
            else:
                logger.warning(f"Invalid origin rejected: {origin}")
        return validated_origins

    def get_security_settings(self) -> Dict:
        """
        Get comprehensive security configuration.
        Implements SOC 2 Type II compliant security controls.
        """
        return {
            "jwt_algorithm": "HS256",
            "jwt_expiration": 3600,  # 1 hour
            "refresh_token_expiration": 604800,  # 1 week
            "password_hash_algorithm": "bcrypt",
            "key_rotation_interval": 86400,  # 24 hours
            "session_timeout": 1800,  # 30 minutes
            "max_login_attempts": 5,
            "lockout_duration": 900,  # 15 minutes
            "audit_log_retention": 90,  # 90 days
            "ssl_verify": self.ENV_STATE == "production",
            "secure_headers": {
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff",
                "X-XSS-Protection": "1; mode=block",
                "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
            }
        }

    def _get_db_url(self) -> str:
        """Securely retrieve database URL."""
        db_url = self._get_env_value("DATABASE_URL")
        return self._encrypt_value(db_url) if self._cipher else db_url

    def _get_cache_url(self) -> str:
        """Securely retrieve cache URL."""
        cache_url = self._get_env_value("REDIS_URL")
        return self._encrypt_value(cache_url) if self._cipher else cache_url

    def _get_origins_list(self) -> List[str]:
        """Get environment-specific CORS origins."""
        origins_str = self._get_env_value("CORS_ORIGINS", "*")
        return origins_str.split(",") if origins_str != "*" else ["*"]

    def _validate_origin(self, origin: str) -> bool:
        """Validate CORS origin for security."""
        if origin == "*" and self.ENV_STATE == "production":
            return False
        # Add additional origin validation logic here
        return True

    def _get_env_value(self, key: str, default: Optional[str] = None) -> str:
        """Securely retrieve environment variables."""
        return getattr(self, key, default)

    def _encrypt_value(self, value: str) -> str:
        """Encrypt sensitive configuration values."""
        return self._cipher.encrypt(value.encode()).decode() if self._cipher else value

    @validator("CONFIG_VERSION")
    def validate_config_version(cls, v):
        """Validate configuration version compatibility."""
        if v.split(".")[0] != "1":
            raise ValueError("Incompatible configuration version")
        return v

@lru_cache()
def get_settings() -> Settings:
    """
    Factory function to get cached settings instance.
    Implements singleton pattern with validation.
    """
    logger.info("Loading application settings")
    settings = Settings()
    logger.info(f"Settings loaded for environment: {settings.ENV_STATE}")
    return settings

# Export settings instance
settings = get_settings()