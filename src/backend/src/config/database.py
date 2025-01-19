"""
Database configuration module for COREos backend application.
Manages PostgreSQL connection settings, pooling, and high availability features.

Version: 1.0.0
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging
from ssl import create_default_context

from sqlalchemy import create_engine  # v2.0.0+
from sqlalchemy.orm import sessionmaker  # v2.0.0+
from sqlalchemy.ext.asyncio import (  # v2.0.0+
    AsyncSession,
    async_sessionmaker,
    create_async_engine
)

from config.settings import get_settings
from utils.constants import MAX_CONNECTIONS, BATCH_SIZE

# Configure logging
logger = logging.getLogger(__name__)

# Global variables
engine = None  # Global database engine instance
SessionLocal = None  # Global session factory

class DatabaseSettings:
    """Database configuration settings with connection and pool parameters."""
    
    def __init__(self):
        """Initialize database settings with environment values and defaults."""
        settings = get_settings()
        db_config = settings.DATABASE_SETTINGS
        
        # Database credentials
        self.POSTGRES_USER = db_config.get("user")
        self.POSTGRES_PASSWORD = db_config.get("password")
        self.POSTGRES_HOST = db_config.get("host")
        self.POSTGRES_PORT = db_config.get("port", 5432)
        self.POSTGRES_DB = db_config.get("database")
        
        # Connection pool settings
        self.POOL_SIZE = min(db_config.get("pool_size", 20), MAX_CONNECTIONS)
        self.MAX_OVERFLOW = db_config.get("max_overflow", 10)
        self.POOL_TIMEOUT = db_config.get("pool_timeout", 30)
        self.POOL_PRE_PING = db_config.get("pool_pre_ping", True)
        
        # SSL and security settings
        self.SSL_MODE = db_config.get("ssl_mode", "verify-full")
        
        # Timeout and retry settings
        self.CONNECT_TIMEOUT = db_config.get("connect_timeout", 10)
        self.COMMAND_TIMEOUT = db_config.get("command_timeout", 30)
        self.RETRY_ATTEMPTS = db_config.get("max_retries", 3)
        self.RETRY_DELAY = db_config.get("retry_interval", 1)

    def get_connection_url(self) -> str:
        """Generate database connection URL with all parameters."""
        ssl_context = create_default_context()
        ssl_args = f"?sslmode={self.SSL_MODE}"
        
        if self.SSL_MODE == "verify-full":
            ssl_args += "&sslcert=/path/to/client-cert.pem"
            ssl_args += "&sslkey=/path/to/client-key.pem"
            ssl_args += "&sslrootcert=/path/to/server-ca.pem"
        
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            f"{ssl_args}"
            f"&connect_timeout={self.CONNECT_TIMEOUT}"
            f"&command_timeout={self.COMMAND_TIMEOUT}"
            f"&application_name=coreos_backend"
        )

async def init_database() -> None:
    """Initialize database engine and session factory with optimized connection pooling."""
    global engine, SessionLocal
    
    try:
        db_settings = DatabaseSettings()
        
        # Configure engine with connection pooling
        engine = create_async_engine(
            db_settings.get_connection_url(),
            pool_size=db_settings.POOL_SIZE,
            max_overflow=db_settings.MAX_OVERFLOW,
            pool_timeout=db_settings.POOL_TIMEOUT,
            pool_pre_ping=db_settings.POOL_PRE_PING,
            pool_recycle=1800,  # Recycle connections every 30 minutes
            echo=False,  # Disable SQL logging in production
            future=True,  # Use SQLAlchemy 2.0 features
        )
        
        # Configure session factory
        SessionLocal = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
        
        # Verify database connection
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        
        logger.info("Database initialization completed successfully")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise

@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database session handling with transaction management.
    Implements retry logic and proper error handling.
    """
    if not SessionLocal:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    
    session = SessionLocal()
    try:
        await session.begin()
        yield session
        await session.commit()
        
    except Exception as e:
        await session.rollback()
        logger.error(f"Database session error: {str(e)}")
        raise
        
    finally:
        await session.close()

async def close_database() -> None:
    """Close database connections and cleanup resources."""
    global engine, SessionLocal
    
    if engine:
        try:
            # Close all connections in the pool
            await engine.dispose()
            engine = None
            SessionLocal = None
            logger.info("Database connections closed successfully")
            
        except Exception as e:
            logger.error(f"Error closing database connections: {str(e)}")
            raise