"""
Enhanced configuration module for the Integration Hub managing external service integrations.
Implements secure configuration handling with validation, versioning, and audit support.

Version: 2.0.0
"""

from datetime import datetime
import logging
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field, SecretStr, validator  # v2.0.3
from config.settings import get_database_settings, get_cors_origins

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supported integration type mappings with versioning
SUPPORTED_CRM_TYPES: Dict[str, str] = {
    'salesforce': 'Salesforce',
    'hubspot': 'HubSpot',
    'zoho': 'Zoho'
}

SUPPORTED_DOCUMENT_TYPES: Dict[str, str] = {
    'google': 'Google Drive',
    'dropbox': 'Dropbox'
}

SUPPORTED_ANALYTICS_PLATFORMS: Dict[str, str] = {
    'mixpanel': 'Mixpanel',
    'segment': 'Segment',
    'amplitude': 'Amplitude'
}

CONFIG_VERSION: str = '2.0.0'

class BaseIntegrationConfig(BaseModel):
    """
    Enhanced base configuration class for all integration types with versioning
    and audit support. Implements secure configuration handling and validation.
    """
    
    # Core identification fields
    integration_id: str = Field(..., description="Unique identifier for the integration")
    organization_id: str = Field(..., description="Organization identifier")
    
    # Status and metadata
    is_active: bool = Field(default=False, description="Integration activation status")
    last_sync_at: Optional[datetime] = Field(default=None, description="Last successful sync timestamp")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional integration metadata"
    )
    
    # Version control
    config_version: str = Field(
        default=CONFIG_VERSION,
        description="Configuration schema version"
    )
    
    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    audit_trail: Dict[str, Any] = Field(
        default_factory=list,
        description="Audit history of configuration changes"
    )

    class Config:
        """Pydantic model configuration"""
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            SecretStr: lambda v: v.get_secret_value() if v else None
        }

    def __init__(self, **data):
        """Initialize base integration configuration with enhanced security."""
        super().__init__(**data)
        self._initialize_audit_trail()
        logger.info(f"Initialized integration config: {self.integration_id}")

    def _initialize_audit_trail(self):
        """Initialize audit trail with creation record."""
        self.audit_trail = [{
            'timestamp': self.created_at,
            'action': 'created',
            'version': self.config_version,
            'changes': None
        }]

    @validator('config_version')
    def validate_config_version(cls, v):
        """Validate configuration version compatibility."""
        major_version = v.split('.')[0]
        if major_version != CONFIG_VERSION.split('.')[0]:
            raise ValueError(f"Incompatible configuration version: {v}")
        return v

    def validate(self) -> bool:
        """
        Enhanced validation with security checks and audit logging.
        Returns True if configuration is valid, False otherwise.
        """
        try:
            # Validate required fields
            if not all([self.integration_id, self.organization_id]):
                logger.error("Missing required fields in integration config")
                return False

            # Validate version compatibility
            self.validate_config_version(self.config_version)

            # Validate audit trail integrity
            if not self.audit_trail or not isinstance(self.audit_trail, list):
                logger.error("Invalid audit trail in integration config")
                return False

            logger.info(f"Validated integration config: {self.integration_id}")
            return True

        except Exception as e:
            logger.error(f"Validation error in integration config: {str(e)}")
            return False

    def update_config(self, updates: Dict[str, Any]) -> bool:
        """
        Update configuration with audit logging and validation.
        
        Args:
            updates: Dictionary containing configuration updates
            
        Returns:
            bool: Update success status
        """
        try:
            # Create audit record before applying updates
            audit_record = {
                'timestamp': datetime.utcnow(),
                'action': 'updated',
                'version': self.config_version,
                'changes': updates.copy()
            }

            # Apply updates
            for key, value in updates.items():
                if hasattr(self, key):
                    setattr(self, key, value)

            # Update timestamp and audit trail
            self.updated_at = datetime.utcnow()
            self.audit_trail.append(audit_record)

            # Validate updated configuration
            if not self.validate():
                logger.error("Validation failed after update")
                return False

            logger.info(f"Updated integration config: {self.integration_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating integration config: {str(e)}")
            return False

    def get_audit_history(self) -> list:
        """
        Retrieve the complete audit history of configuration changes.
        
        Returns:
            list: List of audit records
        """
        return self.audit_trail

    def get_secure_config(self) -> Dict[str, Any]:
        """
        Get configuration with sensitive data masked.
        
        Returns:
            Dict[str, Any]: Masked configuration dictionary
        """
        config_dict = self.dict(exclude={'audit_trail'})
        # Mask any sensitive fields in metadata
        if 'credentials' in config_dict.get('metadata', {}):
            config_dict['metadata']['credentials'] = '**REDACTED**'
        return config_dict