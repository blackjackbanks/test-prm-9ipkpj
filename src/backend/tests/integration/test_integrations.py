# pytest v7.0.0+
# pytest-asyncio v0.21.0+
# httpx v0.24.0+
# Faker v18.0.0+
import pytest
import pytest_asyncio
import httpx
import asyncio
from uuid import UUID
from datetime import datetime, timedelta
from faker import Faker
from typing import Dict, List

from data.schemas.integration import IntegrationCreate, IntegrationResponse
from data.models.integration import IntegrationType, PROVIDER_TYPES

class IntegrationTestData:
    """Helper class for generating realistic integration test data with validation."""
    
    def __init__(self):
        self.faker = Faker()
        Faker.seed(12345)  # Ensure consistent test data
        
        # Provider-specific test configurations
        self.provider_configs = {
            "salesforce": {
                "client_id": self.faker.pystr(min_chars=20, max_chars=30),
                "client_secret": self.faker.pystr(min_chars=40, max_chars=50),
                "instance_url": "https://test.salesforce.com",
                "api_version": "55.0"
            },
            "hubspot": {
                "api_key": self.faker.pystr(min_chars=32, max_chars=32),
                "portal_id": str(self.faker.random_number(digits=8))
            },
            "google": {
                "client_id": f"{self.faker.pystr()}.apps.googleusercontent.com",
                "client_secret": self.faker.pystr(min_chars=24),
                "project_id": f"test-project-{self.faker.random_number()}",
                "scopes": ["https://www.googleapis.com/auth/drive"]
            },
            "mixpanel": {
                "project_token": self.faker.pystr(min_chars=32, max_chars=32),
                "api_secret": self.faker.pystr(min_chars=32, max_chars=32),
                "service_account_username": self.faker.email()
            }
        }
        
        self.integration_types = list(PROVIDER_TYPES.keys())

    def generate_integration(self, organization_id: UUID, provider_type: str = None) -> Dict:
        """Generate valid test integration data for specified provider."""
        if not provider_type:
            provider_type = self.faker.random_element(self.integration_types)
            
        providers = PROVIDER_TYPES[provider_type]
        provider = self.faker.random_element(providers)
        
        return {
            "name": f"Test {provider.title()} Integration {self.faker.random_number(digits=4)}",
            "type": provider_type,
            "provider": provider,
            "organization_id": organization_id,
            "config": self.provider_configs[provider]
        }

@pytest.fixture
def test_data():
    """Fixture providing access to test data generator."""
    return IntegrationTestData()

@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_integrations(client: httpx.AsyncClient, test_user: Dict):
    """Test retrieving organization integrations with performance validation."""
    # Set up test headers
    headers = {
        "Authorization": f"Bearer {test_user['access_token']}",
        "X-Organization-ID": str(test_user['organization_id'])
    }
    
    # Measure response time
    start_time = datetime.now()
    
    # Make request
    response = await client.get(
        "/api/v1/integrations/",
        headers=headers,
        params={"limit": 10, "offset": 0}
    )
    
    # Validate response time (must be under 3 seconds per spec)
    response_time = (datetime.now() - start_time).total_seconds()
    assert response_time < 3.0, f"Response time {response_time}s exceeded 3s limit"
    
    # Validate response
    assert response.status_code == 200
    data = response.json()
    
    # Validate response structure
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)
    
    # Validate each integration matches schema
    for integration in data["items"]:
        integration_response = IntegrationResponse(**integration)
        assert integration_response.organization_id == test_user['organization_id']
    
    # Validate security headers
    assert "X-Content-Type-Options" in response.headers
    assert "X-XSS-Protection" in response.headers
    assert "X-Frame-Options" in response.headers

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.performance
async def test_create_integration_concurrent(
    client: httpx.AsyncClient,
    test_user: Dict,
    test_data: IntegrationTestData
):
    """Test concurrent creation of integrations with performance validation."""
    headers = {
        "Authorization": f"Bearer {test_user['access_token']}",
        "X-Organization-ID": str(test_user['organization_id'])
    }
    
    # Generate test data for multiple integrations
    test_integrations = [
        test_data.generate_integration(test_user['organization_id'])
        for _ in range(5)
    ]
    
    # Create concurrent tasks
    start_time = datetime.now()
    async def create_integration(integration_data):
        return await client.post(
            "/api/v1/integrations/",
            headers=headers,
            json=integration_data
        )
    
    tasks = [
        create_integration(integration)
        for integration in test_integrations
    ]
    
    # Execute concurrent requests
    responses = await asyncio.gather(*tasks)
    
    # Validate total execution time
    total_time = (datetime.now() - start_time).total_seconds()
    assert total_time < 10.0, f"Concurrent creation took {total_time}s, exceeded 10s limit"
    
    # Validate all responses
    for response in responses:
        assert response.status_code == 201
        integration = IntegrationResponse(**response.json())
        assert integration.organization_id == test_user['organization_id']
        assert integration.sync_status == "pending"

@pytest.mark.asyncio
@pytest.mark.integration
async def test_integration_crud_operations(
    client: httpx.AsyncClient,
    test_user: Dict,
    test_data: IntegrationTestData
):
    """Test complete CRUD lifecycle for integrations."""
    headers = {
        "Authorization": f"Bearer {test_user['access_token']}",
        "X-Organization-ID": str(test_user['organization_id'])
    }
    
    # Create integration
    integration_data = test_data.generate_integration(
        test_user['organization_id'],
        provider_type="crm"
    )
    
    create_response = await client.post(
        "/api/v1/integrations/",
        headers=headers,
        json=integration_data
    )
    assert create_response.status_code == 201
    created_integration = IntegrationResponse(**create_response.json())
    
    # Read integration
    get_response = await client.get(
        f"/api/v1/integrations/{created_integration.id}",
        headers=headers
    )
    assert get_response.status_code == 200
    
    # Update integration
    update_data = {"name": f"Updated {integration_data['name']}"}
    update_response = await client.patch(
        f"/api/v1/integrations/{created_integration.id}",
        headers=headers,
        json=update_data
    )
    assert update_response.status_code == 200
    updated_integration = IntegrationResponse(**update_response.json())
    assert updated_integration.name == update_data["name"]
    
    # Delete integration
    delete_response = await client.delete(
        f"/api/v1/integrations/{created_integration.id}",
        headers=headers
    )
    assert delete_response.status_code == 204

@pytest.mark.asyncio
@pytest.mark.integration
async def test_integration_validation(
    client: httpx.AsyncClient,
    test_user: Dict,
    test_data: IntegrationTestData
):
    """Test integration validation rules and error handling."""
    headers = {
        "Authorization": f"Bearer {test_user['access_token']}",
        "X-Organization-ID": str(test_user['organization_id'])
    }
    
    # Test invalid provider
    invalid_data = test_data.generate_integration(test_user['organization_id'])
    invalid_data["provider"] = "invalid_provider"
    
    response = await client.post(
        "/api/v1/integrations/",
        headers=headers,
        json=invalid_data
    )
    assert response.status_code == 422
    
    # Test invalid config
    invalid_config = test_data.generate_integration(test_user['organization_id'])
    invalid_config["config"] = {}
    
    response = await client.post(
        "/api/v1/integrations/",
        headers=headers,
        json=invalid_config
    )
    assert response.status_code == 422
    
    # Test missing required fields
    missing_fields = {
        "name": "Test Integration",
        "organization_id": test_user['organization_id']
    }
    
    response = await client.post(
        "/api/v1/integrations/",
        headers=headers,
        json=missing_fields
    )
    assert response.status_code == 422