"""
Integration test initialization module for COREos backend.
Provides comprehensive test infrastructure setup with CI/CD pipeline support.

Version: 1.0.0
"""

import os
import logging
from typing import List

import pytest  # v7.4.0
from pytest_xdist.plugin import (  # v3.3.1
    pytest_configure as xdist_configure,
    pytest_collection_modifyitems as xdist_collection_modifyitems
)

from config.settings import get_test_settings, configure_test_db, setup_test_security

# Register integration test plugins
pytest_plugins = [
    'tests.integration.fixtures',
    'tests.integration.db_fixtures', 
    'tests.integration.security_fixtures'
]

# Integration test environment identifier
INTEGRATION_TEST_ENV = "integration_test"

# Test categories with descriptions
TEST_CATEGORIES = {
    "api": "API tests",
    "db": "Database tests", 
    "security": "Security tests",
    "performance": "Performance tests"
}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def pytest_configure(config) -> None:
    """
    Enhanced pytest configuration hook for integration test environment setup.
    Configures test environment, database, security context, and CI/CD optimizations.
    
    Args:
        config: pytest configuration object
    """
    logger.info("Configuring integration test environment")
    
    # Set integration test environment
    os.environ["APP_ENV"] = INTEGRATION_TEST_ENV
    
    # Load test settings
    test_settings = get_test_settings()
    
    # Configure test database with isolation
    configure_test_db(
        db_settings=test_settings.DATABASE_SETTINGS,
        isolation_level="REPEATABLE READ"
    )
    
    # Setup security context for tests
    setup_test_security(
        security_settings=test_settings.SECURITY_SETTINGS,
        test_mode=True
    )
    
    # Register test categories as markers
    for category, description in TEST_CATEGORIES.items():
        config.addinivalue_line(
            "markers", 
            f"{category}: {description}"
        )
    
    # Configure parallel execution settings
    if config.getoption("dist", "no") != "no":
        xdist_configure(config)
        config.option.dist = "loadfile"
        config.option.tx = "4"  # Number of worker processes
    
    # Setup performance monitoring
    if "performance" in config.getoption("markexpr", ""):
        config.option.verbose = True
        config.option.durations = 10
        config.option.durations_min = 1.0
    
    # Configure test reporting
    config.option.htmlpath = "reports/integration-tests.html"
    config.option.junitxml = "reports/integration-tests.xml"
    
    logger.info("Integration test environment configured successfully")

def pytest_collection_modifyitems(session, items: List) -> None:
    """
    Enhanced pytest hook to modify test collection for integration tests.
    Implements test categorization, parallel execution groups, and resource management.
    
    Args:
        session: pytest session object
        items: List of collected test items
    """
    logger.info(f"Processing {len(items)} integration test items")
    
    # Filter integration tests
    integration_items = []
    for item in items:
        if any(marker in item.keywords for marker in TEST_CATEGORIES.keys()):
            integration_items.append(item)
    
    # Apply category markers
    for item in integration_items:
        for category in TEST_CATEGORIES.keys():
            if category in item.keywords:
                item.add_marker(getattr(pytest.mark, category))
    
    # Configure parallel execution groups
    if session.config.getoption("dist", "no") != "no":
        xdist_collection_modifyitems(session, integration_items)
        
        # Group tests by category for parallel execution
        for category in TEST_CATEGORIES.keys():
            category_items = [
                item for item in integration_items 
                if category in item.keywords
            ]
            if category_items:
                worker_id = hash(category) % int(session.config.option.tx)
                for item in category_items:
                    item.add_marker(pytest.mark.worker(worker_id))
    
    # Setup database session handling
    for item in integration_items:
        if "db" in item.keywords:
            item.fixturenames.append("db_session")
    
    # Configure API test client
    for item in integration_items:
        if "api" in item.keywords:
            item.fixturenames.extend(["api_client", "auth_token"])
    
    # Setup performance benchmarks
    for item in integration_items:
        if "performance" in item.keywords:
            item.add_marker(pytest.mark.benchmark)
    
    logger.info(f"Processed {len(integration_items)} integration test items")