"""
Redis cache utility module providing thread-safe, high-performance caching functionality.
Implements connection pooling, JSON serialization, pattern-based operations, and comprehensive error handling.

Version: 1.0.0
"""

from redis import Redis, ConnectionPool  # v4.6.0
import json
from typing import Optional, Any, Dict, List, Union
import time

from config.settings import get_settings
from utils.constants import CACHE_TTL_SECONDS, ErrorCodes

# Global instances for singleton pattern
redis_client: Optional[Redis] = None
connection_pool: Optional[ConnectionPool] = None

# Retry configuration
MAX_RETRIES: int = 3
RETRY_DELAY: float = 0.1

class CacheError(Exception):
    """Custom exception for cache-related errors with retry tracking."""
    
    def __init__(self, message: str, retry_count: Optional[int] = None):
        """Initialize cache error with retry information."""
        super().__init__(message)
        self.code = ErrorCodes.CACHE_ERROR.value
        self.message = message
        self.retry_count = retry_count or 0

def get_redis_client() -> Redis:
    """
    Returns a singleton Redis client instance with connection pooling and automatic retry.
    
    Returns:
        Redis: Configured Redis client instance with connection pool
        
    Raises:
        CacheError: If Redis connection cannot be established
    """
    global redis_client, connection_pool
    
    if redis_client is not None:
        return redis_client
    
    try:
        settings = get_settings()
        cache_config = settings.CACHE_SETTINGS
        
        if connection_pool is None:
            connection_pool = ConnectionPool(
                host=cache_config['url'],
                port=6379,
                db=0,
                max_connections=cache_config['pool_size'],
                socket_timeout=cache_config['socket_timeout'],
                socket_connect_timeout=cache_config['socket_connect_timeout'],
                retry_on_timeout=cache_config['retry_on_timeout'],
                health_check_interval=cache_config['health_check_interval']
            )
        
        redis_client = Redis(
            connection_pool=connection_pool,
            ssl=cache_config['ssl'],
            ssl_cert_reqs=None if not cache_config['ssl'] else 'required'
        )
        
        # Test connection
        redis_client.ping()
        return redis_client
    
    except Exception as e:
        raise CacheError(f"Failed to initialize Redis client: {str(e)}")

def set_cache(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """
    Sets a value in cache with JSON serialization and retry logic.
    
    Args:
        key: Cache key
        value: Value to cache (will be JSON serialized if not string)
        ttl: Time-to-live in seconds (defaults to CACHE_TTL_SECONDS)
        
    Returns:
        bool: Success status of cache operation
        
    Raises:
        CacheError: If cache operation fails after retries
    """
    retry_count = 0
    while retry_count < MAX_RETRIES:
        try:
            client = get_redis_client()
            
            # JSON serialize if not string
            if not isinstance(value, str):
                value = json.dumps(value)
                
            # Set with expiration
            success = client.set(
                name=key,
                value=value,
                ex=ttl or CACHE_TTL_SECONDS
            )
            return bool(success)
            
        except Exception as e:
            retry_count += 1
            if retry_count == MAX_RETRIES:
                raise CacheError(
                    f"Failed to set cache key {key}: {str(e)}", 
                    retry_count
                )
            time.sleep(RETRY_DELAY * retry_count)

def get_cache(key: str) -> Optional[Any]:
    """
    Retrieves and deserializes a value from cache with retry logic.
    
    Args:
        key: Cache key to retrieve
        
    Returns:
        Optional[Any]: Deserialized cached value if exists, None otherwise
        
    Raises:
        CacheError: If cache operation fails after retries
    """
    retry_count = 0
    while retry_count < MAX_RETRIES:
        try:
            client = get_redis_client()
            value = client.get(key)
            
            if value is None:
                return None
                
            # Attempt JSON deserialization
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value.decode('utf-8')
                
        except Exception as e:
            retry_count += 1
            if retry_count == MAX_RETRIES:
                raise CacheError(
                    f"Failed to get cache key {key}: {str(e)}", 
                    retry_count
                )
            time.sleep(RETRY_DELAY * retry_count)

def delete_cache(key: str) -> bool:
    """
    Deletes a value from cache with retry logic.
    
    Args:
        key: Cache key to delete
        
    Returns:
        bool: Success status of delete operation
        
    Raises:
        CacheError: If cache operation fails after retries
    """
    retry_count = 0
    while retry_count < MAX_RETRIES:
        try:
            client = get_redis_client()
            return bool(client.delete(key))
            
        except Exception as e:
            retry_count += 1
            if retry_count == MAX_RETRIES:
                raise CacheError(
                    f"Failed to delete cache key {key}: {str(e)}", 
                    retry_count
                )
            time.sleep(RETRY_DELAY * retry_count)

def clear_pattern(pattern: str) -> int:
    """
    Clears all cache entries matching a pattern with batch processing.
    
    Args:
        pattern: Redis key pattern to match (e.g., "user:*")
        
    Returns:
        int: Number of keys cleared
        
    Raises:
        CacheError: If cache operation fails after retries
    """
    retry_count = 0
    while retry_count < MAX_RETRIES:
        try:
            client = get_redis_client()
            pipeline = client.pipeline()
            
            # Scan and delete in batches
            cursor = 0
            deleted_count = 0
            
            while True:
                cursor, keys = client.scan(
                    cursor=cursor, 
                    match=pattern, 
                    count=1000
                )
                
                if keys:
                    pipeline.delete(*keys)
                    pipeline.execute()
                    deleted_count += len(keys)
                
                if cursor == 0:
                    break
                    
            return deleted_count
            
        except Exception as e:
            retry_count += 1
            if retry_count == MAX_RETRIES:
                raise CacheError(
                    f"Failed to clear cache pattern {pattern}: {str(e)}", 
                    retry_count
                )
            time.sleep(RETRY_DELAY * retry_count)