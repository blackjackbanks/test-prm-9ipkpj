"""
Integration tests for template management functionality in the COREos platform.
Tests template CRUD operations, validation, versioning, and organization isolation.

Version: 1.0.0
"""

import json
import pytest  # v7.0.0+
import httpx  # v0.24.0+
from uuid import UUID, uuid4  # Python 3.11+
from datetime import datetime, timezone
from typing import Dict, List, Optional

from data.schemas.template import TemplateCreate
from data.models.template import Template
from utils.exceptions import ValidationException
from utils.constants import HTTPStatusCodes

# API endpoints
API_PREFIX = "/api/v1"
TEMPLATES_URL = f"{API_PREFIX}/templates"

# Test data constants
TEST_TEMPLATE_DATA = {
    "name": "Test Template",
    "category": "Business Process",
    "content": {
        "steps": ["step1", "step2"],
        "version": "1.0.0",
        "metadata": {
            "author": "test_user",
            "created_at": "2023-01-01T00:00:00Z"
        }
    },
    "version": "1.0.0"
}

class TestTemplateFixtures:
    """Test fixtures and utility functions for template integration tests."""
    
    def __init__(self):
        """Initialize test data and configurations."""
        self.default_template_data = TEST_TEMPLATE_DATA.copy()
        self.test_templates: List[Dict] = []
        self.request_timeout = 30  # seconds
        
        # Error test scenarios
        self.invalid_templates = [
            {
                "name": "",  # Empty name
                "category": "Business Process",
                "content": {},
                "version": "1.0.0"
            },
            {
                "name": "Test Template",
                "category": "Invalid Category",  # Invalid category
                "content": {},
                "version": "1.0.0"
            },
            {
                "name": "Test Template",
                "category": "Business Process",
                "content": {},
                "version": "invalid"  # Invalid version format
            }
        ]

    async def create_test_template(
        self,
        db_session,
        test_user: Dict,
        version: str = "1.0.0"
    ) -> Template:
        """Create a test template in the database."""
        template_data = self.default_template_data.copy()
        template_data["version"] = version
        template_data["org_id"] = test_user["org_id"]
        
        template = Template(
            name=template_data["name"],
            category=template_data["category"],
            content=template_data["content"],
            version=template_data["version"],
            org_id=UUID(test_user["org_id"])
        )
        
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)
        
        return template

@pytest.mark.asyncio
async def test_create_template(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict
) -> None:
    """Test successful template creation."""
    # Prepare test data
    template_data = TEST_TEMPLATE_DATA.copy()
    template_data["org_id"] = test_user["org_id"]
    
    # Send create request
    response = await client.post(
        TEMPLATES_URL,
        json=template_data,
        headers=auth_headers,
        timeout=30.0
    )
    
    # Verify response
    assert response.status_code == HTTPStatusCodes.CREATED.value
    data = response.json()
    
    # Validate response data
    assert data["name"] == template_data["name"]
    assert data["category"] == template_data["category"]
    assert data["version"] == template_data["version"]
    assert data["org_id"] == test_user["org_id"]
    assert UUID(data["id"]) is not None
    
    # Verify timestamps
    created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
    updated_at = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
    assert created_at <= datetime.now(timezone.utc)
    assert updated_at <= datetime.now(timezone.utc)

@pytest.mark.asyncio
async def test_get_template(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict,
    db_session
) -> None:
    """Test template retrieval."""
    # Create test template
    fixtures = TestTemplateFixtures()
    template = await fixtures.create_test_template(db_session, test_user)
    
    # Get template
    response = await client.get(
        f"{TEMPLATES_URL}/{template.id}",
        headers=auth_headers,
        timeout=30.0
    )
    
    # Verify response
    assert response.status_code == HTTPStatusCodes.OK.value
    data = response.json()
    
    # Validate retrieved data
    assert UUID(data["id"]) == template.id
    assert data["name"] == template.name
    assert data["category"] == template.category
    assert data["version"] == template.version
    assert data["org_id"] == str(template.org_id)

@pytest.mark.asyncio
async def test_update_template(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict,
    db_session
) -> None:
    """Test template update functionality."""
    # Create test template
    fixtures = TestTemplateFixtures()
    template = await fixtures.create_test_template(db_session, test_user)
    
    # Update data
    update_data = {
        "name": "Updated Template",
        "version": "1.1.0",
        "content": {
            "steps": ["updated_step1", "updated_step2"],
            "version": "1.1.0"
        }
    }
    
    # Send update request
    response = await client.patch(
        f"{TEMPLATES_URL}/{template.id}",
        json=update_data,
        headers=auth_headers,
        timeout=30.0
    )
    
    # Verify response
    assert response.status_code == HTTPStatusCodes.OK.value
    data = response.json()
    
    # Validate updated data
    assert data["name"] == update_data["name"]
    assert data["version"] == update_data["version"]
    assert data["content"] == update_data["content"]
    assert datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00")) > \
           datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))

@pytest.mark.asyncio
async def test_delete_template(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict,
    db_session
) -> None:
    """Test template deletion."""
    # Create test template
    fixtures = TestTemplateFixtures()
    template = await fixtures.create_test_template(db_session, test_user)
    
    # Delete template
    response = await client.delete(
        f"{TEMPLATES_URL}/{template.id}",
        headers=auth_headers,
        timeout=30.0
    )
    
    # Verify deletion
    assert response.status_code == HTTPStatusCodes.NO_CONTENT.value
    
    # Verify template no longer exists
    get_response = await client.get(
        f"{TEMPLATES_URL}/{template.id}",
        headers=auth_headers,
        timeout=30.0
    )
    assert get_response.status_code == HTTPStatusCodes.NOT_FOUND.value

@pytest.mark.asyncio
async def test_template_validation(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict
) -> None:
    """Test template validation rules."""
    fixtures = TestTemplateFixtures()
    
    for invalid_template in fixtures.invalid_templates:
        invalid_template["org_id"] = test_user["org_id"]
        
        # Test invalid template creation
        response = await client.post(
            TEMPLATES_URL,
            json=invalid_template,
            headers=auth_headers,
            timeout=30.0
        )
        
        # Verify validation error
        assert response.status_code == HTTPStatusCodes.BAD_REQUEST.value
        error_data = response.json()
        assert "error" in error_data
        assert error_data["error"]["code"].startswith("validation_")

@pytest.mark.asyncio
async def test_organization_isolation(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict,
    db_session
) -> None:
    """Test template organization isolation."""
    # Create template for test user
    fixtures = TestTemplateFixtures()
    template = await fixtures.create_test_template(db_session, test_user)
    
    # Create different organization context
    other_org_id = str(uuid4())
    other_auth_headers = auth_headers.copy()
    other_auth_headers["X-Organization-ID"] = other_org_id
    
    # Attempt to access template from different organization
    response = await client.get(
        f"{TEMPLATES_URL}/{template.id}",
        headers=other_auth_headers,
        timeout=30.0
    )
    
    # Verify access denied
    assert response.status_code == HTTPStatusCodes.NOT_FOUND.value

@pytest.mark.asyncio
async def test_template_version_control(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict,
    db_session
) -> None:
    """Test template version control functionality."""
    # Create initial version
    fixtures = TestTemplateFixtures()
    template = await fixtures.create_test_template(
        db_session,
        test_user,
        version="1.0.0"
    )
    
    # Create new version
    new_version_data = TEST_TEMPLATE_DATA.copy()
    new_version_data["version"] = "1.1.0"
    new_version_data["org_id"] = test_user["org_id"]
    new_version_data["content"]["version"] = "1.1.0"
    
    response = await client.post(
        f"{TEMPLATES_URL}/{template.id}/versions",
        json=new_version_data,
        headers=auth_headers,
        timeout=30.0
    )
    
    # Verify version creation
    assert response.status_code == HTTPStatusCodes.CREATED.value
    data = response.json()
    assert data["version"] == "1.1.0"
    assert data["previous_version"] == "1.0.0"

@pytest.mark.asyncio
async def test_template_list_pagination(
    client: httpx.AsyncClient,
    auth_headers: Dict,
    test_user: Dict,
    db_session
) -> None:
    """Test template listing with pagination."""
    # Create multiple templates
    fixtures = TestTemplateFixtures()
    for i in range(5):
        await fixtures.create_test_template(
            db_session,
            test_user,
            version=f"1.0.{i}"
        )
    
    # Test pagination
    page_size = 2
    response = await client.get(
        f"{TEMPLATES_URL}?page=1&page_size={page_size}",
        headers=auth_headers,
        timeout=30.0
    )
    
    # Verify pagination
    assert response.status_code == HTTPStatusCodes.OK.value
    data = response.json()
    assert len(data["items"]) == page_size
    assert data["total"] >= 5
    assert "next_page" in data