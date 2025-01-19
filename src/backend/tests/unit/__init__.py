"""
Unit test initialization module for COREos backend.
Configures test environment, fixtures, and utilities specific to unit testing.

Version: 1.0.0
"""

import os
import logging
from typing import List

import pytest  # v7.4.0
from config.settings import get_test_settings

# Register pytest plugins for unit testing
pytest_plugins = [
    'tests.unit.fixtures',  # Common test fixtures
    'tests.unit.markers',   # Custom test markers
    'tests.unit.mocks'      # Mock configurations
]

# Unit test environment identifier
UNIT_TEST_ENV = 'unit_test'

def pytest_configure(config):
    """
    Pytest hook for configuring the unit test environment.
    Sets up test isolation, mocking, and reporting configurations.

    Args:
        config: Pytest configuration object
    """
    # Set test environment
    os.environ['ENVIRONMENT'] = UNIT_TEST_ENV
    
    # Load test-specific settings
    test_settings = get_test_settings()
    
    # Register custom markers for unit tests
    config.addinivalue_line("markers", "api: mark test as API unit test")
    config.addinivalue_line("markers", "model: mark test as model unit test")
    config.addinivalue_line("markers", "service: mark test as service unit test")
    config.addinivalue_line("markers", "util: mark test as utility unit test")
    
    # Configure test isolation settings
    config.option.isolated = True
    
    # Set up test coverage reporting
    config.option.cov_report = {
        'term-missing': True,
        'html': True,
        'xml': True
    }
    
    # Configure logging for test environment
    logging.basicConfig(
        level=logging.DEBUG if test_settings.DEBUG else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Initialize mock configurations
    config.pluginmanager.register(MockConfigurationPlugin(), 'mock_config')

def pytest_collection_modifyitems(session, items: List[pytest.Item]):
    """
    Pytest hook for modifying test collection.
    Configures test dependencies, ordering, and categorization.

    Args:
        session: Pytest session object
        items: List of collected test items
    """
    # Filter for unit tests only
    for item in items:
        # Apply unit test markers based on path
        if "api" in str(item.fspath):
            item.add_marker(pytest.mark.api)
        elif "models" in str(item.fspath):
            item.add_marker(pytest.mark.model)
        elif "services" in str(item.fspath):
            item.add_marker(pytest.mark.service)
        elif "utils" in str(item.fspath):
            item.add_marker(pytest.mark.util)
        
        # Set up test isolation
        item.add_marker(pytest.mark.isolated)
        
        # Configure test timeouts
        item.add_marker(pytest.mark.timeout(30))  # 30 second timeout
        
        # Set up parallel execution groups
        if item.get_closest_marker('api'):
            item.add_marker(pytest.mark.group('api'))
        elif item.get_closest_marker('model'):
            item.add_marker(pytest.mark.group('model'))
        elif item.get_closest_marker('service'):
            item.add_marker(pytest.mark.group('service'))
        elif item.get_closest_marker('util'):
            item.add_marker(pytest.mark.group('util'))

class MockConfigurationPlugin:
    """Plugin for configuring mock behaviors in unit tests."""
    
    @pytest.hookimpl(tryfirst=True)
    def pytest_runtest_setup(self, item):
        """Configure test-specific mocks before each test."""
        # Set up common mocks
        item.funcargs['mock_db'] = create_db_mock()
        item.funcargs['mock_cache'] = create_cache_mock()
        item.funcargs['mock_ai'] = create_ai_mock()
        
        # Configure integration mocks based on markers
        if item.get_closest_marker('api'):
            item.funcargs['mock_auth'] = create_auth_mock()
        elif item.get_closest_marker('service'):
            item.funcargs['mock_integration'] = create_integration_mock()

def create_db_mock():
    """Create database mock for unit tests."""
    return {}

def create_cache_mock():
    """Create cache mock for unit tests."""
    return {}

def create_ai_mock():
    """Create AI service mock for unit tests."""
    return {}

def create_auth_mock():
    """Create authentication mock for unit tests."""
    return {}

def create_integration_mock():
    """Create integration service mock for unit tests."""
    return {}