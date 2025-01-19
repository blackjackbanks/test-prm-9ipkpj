"""
Pytest configuration file for COREos backend test suite providing comprehensive test infrastructure
with database isolation, security features, and performance monitoring.

Version: 1.0.0
"""

import pytest  # v7.0.0+
from sqlalchemy.ext.asyncio import AsyncSession  # v2.0.0+
from httpx import AsyncClient  # v0.24.0+
import logging
from typing import Dict, AsyncGenerator
from datetime import datetime, timedelta

from config.database import init_database, get_db
from config.settings import settings, get_test_settings
from security.jwt import create_access_token, validate_token

# Test user credentials
TEST_USER_EMAIL: str = 'test@coreos.com'
TEST_USER_PASSWORD: str = 'test123!'
TEST_ADMIN_EMAIL: str = 'admin@coreos.com'
TEST_ADMIN_PASSWORD: str = 'admin123!'
TEST_TIMEOUT: int = 30

# Configure test logger
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_suite")

async def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest settings before test execution with enhanced logging and security.
    
    Args:
        config: Pytest configuration object
    """
    # Set test environment
    settings.ENV_STATE = "test"
    
    # Configure test database settings
    test_settings = get_test_settings()
    settings.DATABASE_SETTINGS = test_settings.DATABASE_SETTINGS
    
    # Initialize test logging
    logging.getLogger("test_audit").setLevel(logging.DEBUG)
    
    # Register custom markers
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "security: mark test as security test")
    config.addinivalue_line("markers", "performance: mark test as performance test")
    
    logger.info("Test configuration initialized successfully")

async def pytest_sessionstart(session: pytest.Session) -> None:
    """
    Setup operations before test session starts with proper initialization.
    
    Args:
        session: Pytest session object
    """
    try:
        # Initialize test database
        await init_database()
        logger.info("Test database initialized")
        
        # Create test audit log
        logging.getLogger("test_audit").info(
            f"Test session started at {datetime.utcnow().isoformat()}"
        )
        
    except Exception as e:
        logger.error(f"Test session initialization failed: {str(e)}")
        raise

async def pytest_sessionfinish(session: pytest.Session) -> None:
    """
    Cleanup operations after test session ends with proper resource management.
    
    Args:
        session: Pytest session object
    """
    try:
        # Clean up test database
        from config.database import close_database
        await close_database()
        
        # Archive test logs
        logging.getLogger("test_audit").info(
            f"Test session completed at {datetime.utcnow().isoformat()}"
        )
        
    except Exception as e:
        logger.error(f"Test session cleanup failed: {str(e)}")
        raise

@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async database session fixture with transaction isolation.
    
    Yields:
        AsyncSession: Database session with transaction support
    """
    try:
        async with get_db() as session:
            # Start transaction
            await session.begin()
            
            # Log database operation
            logger.debug("Test database session started")
            
            yield session
            
            # Rollback changes after test
            await session.rollback()
            logger.debug("Test database session rolled back")
            
    except Exception as e:
        logger.error(f"Database session error: {str(e)}")
        raise
    
    finally:
        # Ensure session is closed
        await session.close()
        logger.debug("Test database session closed")

@pytest.fixture(scope="function")
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Async HTTP client fixture with enhanced configuration.
    
    Yields:
        AsyncClient: HTTP client with timeout and error handling
    """
    try:
        async with AsyncClient(
            base_url="http://test",
            timeout=TEST_TIMEOUT,
            follow_redirects=True
        ) as client:
            # Configure client headers
            client.headers.update({
                "Accept": "application/json",
                "Content-Type": "application/json"
            })
            
            logger.debug("Test HTTP client initialized")
            yield client
            
    except Exception as e:
        logger.error(f"HTTP client error: {str(e)}")
        raise

@pytest.fixture
def auth_headers(test_user: Dict) -> Dict[str, str]:
    """
    Authentication headers fixture with enhanced security.
    
    Args:
        test_user: Test user credentials and roles
        
    Returns:
        Dict[str, str]: Headers with secure Bearer token
    """
    try:
        # Generate access token
        access_token = create_access_token(
            data={"sub": test_user["email"]},
            roles=test_user["roles"],
            permissions=test_user["permissions"],
            expires_delta=timedelta(minutes=30)
        )
        
        # Validate token
        validate_token(access_token)
        
        # Create headers
        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-Request-ID": str(datetime.utcnow().timestamp())
        }
        
        logger.debug(f"Auth headers created for user {test_user['email']}")
        return headers
        
    except Exception as e:
        logger.error(f"Auth headers creation failed: {str(e)}")
        raise

@pytest.fixture(scope="session")
def test_user() -> Dict[str, str]:
    """
    Test user fixture with enhanced role support.
    
    Returns:
        Dict[str, str]: Test user credentials with roles
    """
    try:
        user = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "roles": ["user"],
            "permissions": {
                "read": True,
                "write": True
            }
        }
        
        logger.debug(f"Test user created: {user['email']}")
        return user
        
    except Exception as e:
        logger.error(f"Test user creation failed: {str(e)}")
        raise