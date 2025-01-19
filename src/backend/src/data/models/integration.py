# SQLAlchemy v2.0.0+
from sqlalchemy import Column, String, Boolean, JSON, DateTime, ForeignKey, Enum
from sqlalchemy.orm import validates, declarative_base
from sqlalchemy.dialects.postgresql import UUID
import enum
from datetime import datetime
import uuid

Base = declarative_base()

# Mapping of supported providers for each integration type
PROVIDER_TYPES = {
    'crm': ['salesforce', 'hubspot'],
    'documents': ['google', 'dropbox'],
    'analytics': ['mixpanel', 'amplitude']
}

class IntegrationType(enum.Enum):
    """
    Enumeration of supported integration categories in the COREos platform.
    Used to classify and validate integration types during configuration.
    """
    crm = "crm"
    documents = "documents"
    analytics = "analytics"

    def __str__(self):
        return self.value

class Integration(Base):
    """
    SQLAlchemy model for external service integrations in the COREos platform.
    Manages integration configurations, metadata, and synchronization status for
    CRM, document storage, and analytics tools.
    """
    __tablename__ = 'integrations'

    # Primary key and relationship fields
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True), 
        ForeignKey('organizations.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Core integration fields
    name = Column(String(255), nullable=False)
    type = Column(
        Enum(IntegrationType),
        nullable=False,
        index=True
    )
    provider = Column(String(50), nullable=False)
    config = Column(
        JSON,
        nullable=False,
        default=dict
    )
    active = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True
    )

    # Timestamp tracking
    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    last_sync_at = Column(
        DateTime,
        nullable=True
    )

    @validates('provider')
    def validate_provider(self, key, provider):
        """
        Validates if the specified provider is supported for the given integration type.
        
        Args:
            key (str): Field name being validated (provider)
            provider (str): Name of the integration provider
            
        Returns:
            str: Validated provider name
            
        Raises:
            ValueError: If provider is not supported for the integration type
        """
        if not isinstance(self.type, IntegrationType):
            raise ValueError("Integration type must be set before validating provider")

        type_providers = PROVIDER_TYPES.get(self.type.value, [])
        if provider not in type_providers:
            raise ValueError(
                f"Invalid provider '{provider}' for integration type '{self.type}'. "
                f"Supported providers are: {', '.join(type_providers)}"
            )
        return provider

    def __repr__(self):
        """String representation of the Integration model."""
        return (
            f"<Integration(id={self.id}, "
            f"organization_id={self.organization_id}, "
            f"name='{self.name}', "
            f"type={self.type}, "
            f"provider='{self.provider}', "
            f"active={self.active})>"
        )