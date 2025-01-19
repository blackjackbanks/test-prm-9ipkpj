"""
Base repository class providing common database operations with enhanced support for 
versioning, audit logging, and performance optimization.

Version: 1.0.0
"""

from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Type, TypeVar, Generic
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete

from config.database import get_db
from utils.exceptions import NotFoundException
from utils.helpers import generate_uuid

# Configure logging
logger = logging.getLogger(__name__)

# Type variable for model class
T = TypeVar('T', bound='BaseModel')

class BaseRepository(Generic[T]):
    """
    Generic base repository class providing common database operations with enhanced
    support for versioning, audit logging, and performance optimization.
    """

    def __init__(self, model_class: Type[T]):
        """
        Initialize repository with model class and setup caching.

        Args:
            model_class: SQLAlchemy model class for the repository
        """
        self._model_class = model_class
        self._db: Optional[AsyncSession] = None
        self._cache: Dict = {}

    @asynccontextmanager
    async def _get_session(self) -> AsyncSession:
        """Get database session with connection pooling."""
        async with get_db() as session:
            self._db = session
            try:
                yield session
            finally:
                self._db = None

    @asynccontextmanager
    async def get_by_id(self, id: str) -> Optional[T]:
        """
        Retrieve a record by its ID with caching support.

        Args:
            id: Record identifier

        Returns:
            Optional[T]: Found record or None

        Raises:
            NotFoundException: If record not found
        """
        # Check cache first
        cache_key = f"{self._model_class.__name__}:{id}"
        if cache_key in self._cache:
            yield self._cache[cache_key]
            return

        async with self._get_session() as session:
            try:
                # Build optimized query
                query = (
                    select(self._model_class)
                    .where(self._model_class.id == id)
                    .where(self._model_class.deleted_at.is_(None))
                )

                # Execute query with connection pooling
                result = await session.execute(query)
                record = result.scalar_one_or_none()

                if not record:
                    raise NotFoundException(
                        message=f"{self._model_class.__name__} not found",
                        error_code="repo_001",
                        details={"id": id}
                    )

                # Update cache
                self._cache[cache_key] = record
                yield record

            except Exception as e:
                logger.error(f"Error retrieving {self._model_class.__name__}: {str(e)}")
                raise

    @asynccontextmanager
    async def get_all(
        self,
        filters: Optional[Dict] = None,
        page: Optional[int] = None,
        size: Optional[int] = None
    ) -> List[T]:
        """
        Retrieve all records with pagination and filtering.

        Args:
            filters: Optional filter conditions
            page: Page number for pagination
            size: Page size for pagination

        Returns:
            List[T]: List of records
        """
        async with self._get_session() as session:
            try:
                # Build base query
                query = select(self._model_class).where(
                    self._model_class.deleted_at.is_(None)
                )

                # Apply filters
                if filters:
                    for key, value in filters.items():
                        if hasattr(self._model_class, key):
                            query = query.where(getattr(self._model_class, key) == value)

                # Apply pagination
                if page is not None and size is not None:
                    query = query.offset((page - 1) * size).limit(size)

                # Execute query
                result = await session.execute(query)
                records = result.scalars().all()

                yield records

            except Exception as e:
                logger.error(f"Error retrieving {self._model_class.__name__} list: {str(e)}")
                raise

    @asynccontextmanager
    async def create(self, data: Dict) -> T:
        """
        Create a new record with validation and versioning.

        Args:
            data: Record data

        Returns:
            T: Created record
        """
        async with self._get_session() as session:
            try:
                # Generate new UUID and add metadata
                data['id'] = generate_uuid()
                data['version'] = 1
                data['created_at'] = datetime.utcnow()
                data['updated_at'] = data['created_at']

                # Create and insert record
                query = insert(self._model_class).values(**data).returning(self._model_class)
                result = await session.execute(query)
                record = result.scalar_one()

                # Commit transaction
                await session.commit()

                # Clear relevant caches
                self._cache.clear()

                yield record

            except Exception as e:
                await session.rollback()
                logger.error(f"Error creating {self._model_class.__name__}: {str(e)}")
                raise

    @asynccontextmanager
    async def update(self, id: str, data: Dict) -> T:
        """
        Update record with version control and audit.

        Args:
            id: Record identifier
            data: Update data

        Returns:
            T: Updated record
        """
        async with self._get_session() as session:
            try:
                # Get current record
                query = select(self._model_class).where(
                    self._model_class.id == id,
                    self._model_class.deleted_at.is_(None)
                )
                result = await session.execute(query)
                record = result.scalar_one_or_none()

                if not record:
                    raise NotFoundException(
                        message=f"{self._model_class.__name__} not found",
                        error_code="repo_002",
                        details={"id": id}
                    )

                # Update metadata
                data['version'] = record.version + 1
                data['updated_at'] = datetime.utcnow()

                # Perform update
                query = (
                    update(self._model_class)
                    .where(self._model_class.id == id)
                    .values(**data)
                    .returning(self._model_class)
                )
                result = await session.execute(query)
                updated_record = result.scalar_one()

                # Commit transaction
                await session.commit()

                # Clear caches
                self._cache.clear()

                yield updated_record

            except Exception as e:
                await session.rollback()
                logger.error(f"Error updating {self._model_class.__name__}: {str(e)}")
                raise

    @asynccontextmanager
    async def delete(self, id: str) -> bool:
        """
        Soft delete record with audit trail.

        Args:
            id: Record identifier

        Returns:
            bool: True if deleted successfully
        """
        async with self._get_session() as session:
            try:
                # Perform soft delete
                query = (
                    update(self._model_class)
                    .where(
                        self._model_class.id == id,
                        self._model_class.deleted_at.is_(None)
                    )
                    .values(
                        deleted_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    .returning(self._model_class.id)
                )
                result = await session.execute(query)
                deleted = result.scalar_one_or_none() is not None

                if not deleted:
                    raise NotFoundException(
                        message=f"{self._model_class.__name__} not found",
                        error_code="repo_003",
                        details={"id": id}
                    )

                # Commit transaction
                await session.commit()

                # Clear caches
                self._cache.clear()

                yield deleted

            except Exception as e:
                await session.rollback()
                logger.error(f"Error deleting {self._model_class.__name__}: {str(e)}")
                raise