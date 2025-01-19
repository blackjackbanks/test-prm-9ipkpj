# pydantic v2.0.0+
from pydantic import BaseModel, Field, ConfigDict, constr, Json, validator
from uuid import UUID
from datetime import datetime
from data.models.integration import IntegrationType, PROVIDER_TYPES

# Provider-specific configuration schemas with validation rules
PROVIDER_CONFIG_SCHEMAS = {
    "salesforce": {
        "required": ["client_id", "client_secret", "instance_url"],
        "properties": {
            "client_id": {"type": "string", "minLength": 10},
            "client_secret": {"type": "string", "minLength": 20},
            "instance_url": {"type": "string", "format": "uri"},
            "api_version": {"type": "string", "pattern": "^[0-9]{2}\.0$"}
        }
    },
    "hubspot": {
        "required": ["api_key", "portal_id"],
        "properties": {
            "api_key": {"type": "string", "minLength": 32},
            "portal_id": {"type": "string", "pattern": "^[0-9]+$"}
        }
    },
    "google": {
        "required": ["client_id", "client_secret", "project_id"],
        "properties": {
            "client_id": {"type": "string"},
            "client_secret": {"type": "string"},
            "project_id": {"type": "string"},
            "scopes": {"type": "array", "items": {"type": "string"}}
        }
    },
    "dropbox": {
        "required": ["app_key", "app_secret"],
        "properties": {
            "app_key": {"type": "string"},
            "app_secret": {"type": "string"},
            "access_token": {"type": "string"}
        }
    },
    "mixpanel": {
        "required": ["project_token", "api_secret"],
        "properties": {
            "project_token": {"type": "string", "minLength": 32},
            "api_secret": {"type": "string", "minLength": 32},
            "service_account_username": {"type": "string", "format": "email"}
        }
    },
    "amplitude": {
        "required": ["api_key", "secret_key"],
        "properties": {
            "api_key": {"type": "string", "minLength": 32},
            "secret_key": {"type": "string", "minLength": 32}
        }
    }
}

class IntegrationBase(BaseModel):
    """Base Pydantic model for integration data validation with enhanced validation rules."""
    
    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    name: constr(min_length=3, max_length=255, pattern=r'^[a-zA-Z0-9\s\-_]+$') = Field(
        ...,
        description="Integration display name",
        examples=["Sales CRM", "Document Storage"]
    )
    
    type: IntegrationType = Field(
        ...,
        description="Integration category type",
        examples=["crm", "documents", "analytics"]
    )
    
    provider: str = Field(
        ...,
        description="Integration service provider",
        examples=["salesforce", "google", "mixpanel"]
    )
    
    config: Json = Field(
        ...,
        description="Provider-specific configuration",
        examples=[{
            "client_id": "xxx",
            "client_secret": "yyy",
            "instance_url": "https://example.salesforce.com"
        }]
    )
    
    active: bool = Field(
        default=False,
        description="Integration activation status"
    )

    @validator('provider')
    def validate_provider(cls, provider: str, values: dict) -> str:
        """Validates provider against supported types with enhanced error messages."""
        if 'type' not in values:
            raise ValueError("Integration type must be specified before provider")
            
        type_value = values['type'].value
        valid_providers = PROVIDER_TYPES.get(type_value, [])
        
        if provider not in valid_providers:
            raise ValueError(
                f"Invalid provider '{provider}' for integration type '{type_value}'. "
                f"Supported providers: {', '.join(valid_providers)}"
            )
        return provider

    @validator('config')
    def validate_config(cls, config: dict, values: dict) -> dict:
        """Validates configuration against provider-specific schema."""
        if 'provider' not in values:
            raise ValueError("Provider must be specified before config validation")
            
        provider = values['provider']
        schema = PROVIDER_CONFIG_SCHEMAS.get(provider)
        
        if not schema:
            raise ValueError(f"No configuration schema defined for provider '{provider}'")
            
        # Validate required fields
        required_fields = schema.get('required', [])
        missing_fields = [field for field in required_fields if field not in config]
        if missing_fields:
            raise ValueError(f"Missing required fields for {provider}: {', '.join(missing_fields)}")
            
        # Validate field formats and constraints
        properties = schema.get('properties', {})
        for field_name, field_value in config.items():
            if field_name not in properties:
                raise ValueError(f"Unknown field '{field_name}' for provider '{provider}'")
                
            field_schema = properties[field_name]
            
            # Validate string constraints
            if field_schema['type'] == 'string':
                if 'minLength' in field_schema and len(str(field_value)) < field_schema['minLength']:
                    raise ValueError(
                        f"Field '{field_name}' must be at least {field_schema['minLength']} characters long"
                    )
                if 'pattern' in field_schema and not re.match(field_schema['pattern'], str(field_value)):
                    raise ValueError(f"Field '{field_name}' has invalid format")
                    
        return config

class IntegrationCreate(IntegrationBase):
    """Schema for creating new integrations with organization context."""
    
    organization_id: UUID = Field(
        ...,
        description="Organization ID owning the integration"
    )

class IntegrationUpdate(IntegrationBase):
    """Schema for updating existing integrations with partial updates."""
    
    name: Optional[constr(min_length=3, max_length=255, pattern=r'^[a-zA-Z0-9\s\-_]+$')] = None
    type: Optional[IntegrationType] = None
    provider: Optional[str] = None
    config: Optional[Json] = None
    active: Optional[bool] = None

class IntegrationResponse(IntegrationBase):
    """Schema for integration API responses with sync status."""
    
    id: UUID = Field(
        ...,
        description="Integration unique identifier"
    )
    
    organization_id: UUID = Field(
        ...,
        description="Organization ID owning the integration"
    )
    
    created_at: datetime = Field(
        ...,
        description="Integration creation timestamp"
    )
    
    updated_at: datetime = Field(
        ...,
        description="Last update timestamp"
    )
    
    last_sync_at: Optional[datetime] = Field(
        None,
        description="Last successful sync timestamp"
    )
    
    sync_status: str = Field(
        default="pending",
        description="Current sync status",
        examples=["pending", "syncing", "completed", "failed"]
    )
    
    sync_error: Optional[dict] = Field(
        None,
        description="Last sync error details"
    )