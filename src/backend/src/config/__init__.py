"""
Core configuration module that initializes and exports all configuration components
for the COREos backend application with thread-safety, error handling, and health checks.

Version: 1.0.0
"""

import threading  # v3.11+
from prometheus_client import Counter, Gauge  # v0.17+

from config.settings import get_database_settings, get_cache_settings, validate_settings
from config.logging import setup_logging
from config.security import SecurityConfig
from config.database import init_database, get_db, close_database

# Initialize thread synchronization primitives
_init_lock = threading.Lock()
_initialized = threading.Event()

# Initialize Prometheus metrics
config_init_counter = Counter(
    'config_initialization_total',
    'Total number of configuration initialization attempts',
    ['status']
)

component_health = Gauge(
    'component_health_status',
    'Health status of system components',
    ['component']
)

# Global configuration instances
logger = None
security_config = None

async def init_app(validate: bool = True) -> bool:
    """
    Initialize all application configurations with thread safety and health checks.
    
    Args:
        validate: Whether to validate configurations
        
    Returns:
        bool: True if initialization successful, False otherwise
    """
    global logger, security_config
    
    with _init_lock:
        try:
            # Check if already initialized
            if _initialized.is_set():
                logger.info("Configuration already initialized")
                return True
                
            config_init_counter.labels(status='attempt').inc()
            
            # Initialize and validate settings
            if validate:
                validate_settings()
            
            # Setup logging with audit capability
            logger = setup_logging(
                service_name="coreos-backend",
                extra_context={"component": "config"}
            )
            logger.info("Logging system initialized")
            
            # Initialize security configuration
            security_config = SecurityConfig()
            logger.info("Security configuration initialized")
            
            # Initialize database connection
            await init_database()
            logger.info("Database connection initialized")
            
            # Set initialization flag
            _initialized.set()
            config_init_counter.labels(status='success').inc()
            
            # Update health metrics
            component_health.labels(component='config').set(1)
            
            logger.info("Application configuration completed successfully")
            return True
            
        except Exception as e:
            config_init_counter.labels(status='failure').inc()
            component_health.labels(component='config').set(0)
            
            if logger:
                logger.error(f"Configuration initialization failed: {str(e)}")
            return False

async def check_health() -> dict:
    """
    Check health status of all configuration components.
    
    Returns:
        dict: Health status of all components
    """
    health_status = {
        "initialized": _initialized.is_set(),
        "components": {}
    }
    
    try:
        # Check database health
        async with get_db() as db:
            await db.execute("SELECT 1")
            health_status["components"]["database"] = "healthy"
    except Exception as e:
        health_status["components"]["database"] = f"unhealthy: {str(e)}"
        component_health.labels(component='database').set(0)
    else:
        component_health.labels(component='database').set(1)
    
    # Check security configuration
    try:
        security_config.verify_password("test", security_config.get_password_hash("test"))
        health_status["components"]["security"] = "healthy"
        component_health.labels(component='security').set(1)
    except Exception as e:
        health_status["components"]["security"] = f"unhealthy: {str(e)}"
        component_health.labels(component='security').set(0)
    
    # Check logging system
    try:
        logger.debug("Health check logging test")
        health_status["components"]["logging"] = "healthy"
        component_health.labels(component='logging').set(1)
    except Exception as e:
        health_status["components"]["logging"] = f"unhealthy: {str(e)}"
        component_health.labels(component='logging').set(0)
    
    return health_status

async def cleanup() -> None:
    """Cleanup and close all configuration components."""
    global logger, security_config
    
    with _init_lock:
        if _initialized.is_set():
            try:
                # Close database connections
                await close_database()
                
                # Reset initialization flag
                _initialized.clear()
                
                # Clear global instances
                logger = None
                security_config = None
                
                # Update health metrics
                component_health.labels(component='config').set(0)
                
            except Exception as e:
                if logger:
                    logger.error(f"Cleanup failed: {str(e)}")
                raise

# Export configuration components
__all__ = [
    'init_app',
    'check_health',
    'cleanup',
    'logger',
    'security_config',
    'get_db'
]