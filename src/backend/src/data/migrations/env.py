"""
Alembic migrations environment configuration for COREos platform.
Manages database schema migrations with high availability, connection pooling, and error handling.

Version: 1.0.0
"""

from logging.config import fileConfig
from typing import Optional

from alembic import context  # v1.11.0+
from sqlalchemy import create_engine  # v2.0.0+
from sqlalchemy import pool  # v2.0.0+
from tenacity import retry, stop_after_attempt, wait_exponential  # v8.0.0+

from config.database import DatabaseSettings
from data.models import Base

# Load Alembic configuration
config = context.config

# Configure logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for migrations
target_metadata = Base.metadata

# Connection pool settings
POOL_SIZE = 5
MAX_OVERFLOW = 10
POOL_TIMEOUT = 30
POOL_RECYCLE = 1800  # 30 minutes

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode for generating SQL scripts without database connection.
    Useful for reviewing changes before applying them in production.
    """
    try:
        # Get database URL from settings
        db_settings = DatabaseSettings()
        url = db_settings.get_connection_url()

        # Configure context with URL and target metadata
        context.configure(
            url=url,
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            version_table="alembic_version",
            version_table_schema="public"
        )

        # Generate migration script
        with context.begin_transaction():
            context.run_migrations()

    except Exception as e:
        raise Exception(f"Error in offline migration: {str(e)}")

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode with direct database connection.
    Implements connection pooling, high availability, and error handling.
    """
    try:
        # Get database settings
        db_settings = DatabaseSettings()
        url = db_settings.get_connection_url()

        # Configure connection pool
        pooling_args = {
            "pool_size": POOL_SIZE,
            "max_overflow": MAX_OVERFLOW,
            "pool_timeout": POOL_TIMEOUT,
            "pool_recycle": POOL_RECYCLE,
            "pool_pre_ping": True
        }

        # Create engine with optimized settings
        connectable = create_engine(
            url,
            poolclass=pool.QueuePool,
            **pooling_args,
            isolation_level="REPEATABLE READ",  # Ensure consistency during migrations
            echo=False,  # Disable SQL logging in production
            future=True  # Use SQLAlchemy 2.0 features
        )

        with connectable.connect() as connection:
            # Configure migration context
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
                compare_server_default=True,
                include_schemas=True,
                version_table="alembic_version",
                version_table_schema="public",
                transaction_per_migration=True,  # Run each migration in its own transaction
                render_as_batch=True,  # Enable batch mode for complex migrations
                user_module_prefix="data.models."  # Module prefix for model imports
            )

            # Run migrations within transaction
            with context.begin_transaction():
                context.run_migrations()

    except Exception as e:
        raise Exception(f"Error in online migration: {str(e)}")

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()