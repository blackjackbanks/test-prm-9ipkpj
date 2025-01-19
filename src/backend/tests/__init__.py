"""
Root initialization module for the COREos backend test suite.
Configures test environment, imports required test utilities, and sets up common test infrastructure.

Version: 1.0.0
"""

import os
import logging
from typing import List

import pytest  # v7.4.0
from config.settings import get_test_settings

# Register test plugins and fixtures
pytest_plugins: List[str] = [
    'tests.unit.fixtures',
    'tests.integration.fixtures'
]

# Global test environment identifier
TEST_ENV: str = "test"

def pytest_configure(config) -> None:
    """
    Pytest configuration hook for test environment setup and initialization.
    Configures test infrastructure, logging, and resource management.

    Args:
        config: Pytest configuration object

    Returns:
        None: Configures test environment and infrastructure
    """
    # Set test environment
    os.environ["APP_ENV"] = TEST_ENV
    
    # Load test-specific settings
    test_settings = get_test_settings()
    
    # Configure test logging
    logging.basicConfig(
        level=logging.DEBUG if test_settings.DEBUG else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Register custom markers
    config.addinivalue_line("markers", "unit: mark test as unit test")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "flaky: mark test as potentially unreliable")
    
    # Configure test database isolation
    config.option.postgresql_isolation_level = "REPEATABLE READ"
    
    # Configure test resource cleanup
    config.option.strict = True
    config.option.strict_markers = True
    
    # Configure parallel test execution
    if not test_settings.DEBUG:
        config.option.numprocesses = 'auto'
    
    # Initialize test metrics collection
    config.option.verbose = 2
    config.option.durations = 10
    config.option.durations_min = 1.0

def pytest_collection_modifyitems(session, items) -> None:
    """
    Pytest hook to modify and configure test collection behavior.
    Handles test categorization, ordering, and execution configuration.

    Args:
        session: Pytest session object
        items: List of collected test items

    Returns:
        None: Modifies test collection configuration
    """
    # Apply test type markers based on location
    for item in items:
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
    
    # Configure test isolation and dependencies
    unit_tests = []
    integration_tests = []
    
    for item in items:
        if item.get_closest_marker("unit"):
            unit_tests.append(item)
        elif item.get_closest_marker("integration"):
            integration_tests.append(item)
    
    # Order tests - run unit tests before integration tests
    items[:] = unit_tests + integration_tests
    
    # Configure test timeouts
    for item in items:
        # Set default timeouts
        if item.get_closest_marker("unit"):
            item.add_marker(pytest.mark.timeout(10))
        elif item.get_closest_marker("integration"):
            item.add_marker(pytest.mark.timeout(30))
        
        # Configure flaky test retries
        if item.get_closest_marker("flaky"):
            item.add_marker(pytest.mark.flaky(reruns=3, reruns_delay=1))