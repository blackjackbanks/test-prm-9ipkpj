"""
Health check endpoints module providing comprehensive system monitoring, 
Kubernetes probes, and detailed dependency health checks with metrics collection.

Version: 1.0.0
"""

import time
import psutil
from typing import Dict
import logging
from datetime import datetime

from fastapi import APIRouter, Response, HTTPException  # v0.100.0
import prometheus_client  # v0.17.0
from sqlalchemy import text  # v2.0.0
from redis import Redis  # v4.5.0

from config.settings import VERSION, ENV_STATE, STARTUP_TIME

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix='/health', tags=['Health'])

# Initialize Prometheus metrics
health_check_counter = prometheus_client.Counter(
    'health_check_total',
    'Total number of health checks',
    ['check_type']
)
health_check_latency = prometheus_client.Histogram(
    'health_check_latency_seconds',
    'Health check latency',
    ['check_type']
)
dependency_health = prometheus_client.Gauge(
    'dependency_health',
    'Health status of dependencies',
    ['dependency']
)

async def check_database() -> Dict:
    """Perform database health check."""
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        engine = create_async_engine(str(settings.DATABASE_SETTINGS['url']))
        async with engine.connect() as conn:
            start_time = time.time()
            await conn.execute(text('SELECT 1'))
            response_time = time.time() - start_time
            dependency_health.labels('database').set(1)
            return {
                'status': 'healthy',
                'response_time': round(response_time, 3)
            }
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        dependency_health.labels('database').set(0)
        return {
            'status': 'unhealthy',
            'error': str(e)
        }

async def check_cache() -> Dict:
    """Perform Redis cache health check."""
    try:
        redis_client = Redis.from_url(str(settings.CACHE_SETTINGS['url']))
        start_time = time.time()
        redis_client.ping()
        response_time = time.time() - start_time
        dependency_health.labels('cache').set(1)
        return {
            'status': 'healthy',
            'response_time': round(response_time, 3)
        }
    except Exception as e:
        logger.error(f"Cache health check failed: {str(e)}")
        dependency_health.labels('cache').set(0)
        return {
            'status': 'unhealthy',
            'error': str(e)
        }

def get_system_metrics() -> Dict:
    """Collect system resource metrics."""
    return {
        'cpu_percent': psutil.cpu_percent(),
        'memory_percent': psutil.virtual_memory().percent,
        'disk_percent': psutil.disk_usage('/').percent
    }

@router.get('/', status_code=200)
@health_check_latency.labels('basic').time()
async def get_health() -> Dict:
    """
    Enhanced health check endpoint returning detailed service status with metrics.
    
    Returns:
        Dict: Comprehensive health status response
    """
    health_check_counter.labels('basic').inc()
    
    # Calculate uptime
    uptime = time.time() - STARTUP_TIME
    
    # Collect system metrics
    metrics = get_system_metrics()
    
    return {
        'status': 'ok',
        'version': VERSION,
        'environment': ENV_STATE,
        'timestamp': datetime.utcnow().isoformat(),
        'uptime_seconds': round(uptime, 2),
        'metrics': metrics
    }

@router.get('/live', status_code=204)
@health_check_latency.labels('liveness').time()
async def get_liveness() -> Response:
    """
    Kubernetes liveness probe endpoint with basic application health check.
    
    Returns:
        Response: Empty response with 204 status code if healthy
    """
    health_check_counter.labels('liveness').inc()
    
    try:
        # Basic application health verification
        metrics = get_system_metrics()
        if metrics['cpu_percent'] > 95 or metrics['memory_percent'] > 95:
            raise HTTPException(status_code=500, detail="System resources critical")
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"Liveness check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Application unhealthy")

@router.get('/ready', status_code=200)
@health_check_latency.labels('readiness').time()
async def get_readiness() -> Dict:
    """
    Enhanced Kubernetes readiness probe endpoint with comprehensive dependency checks.
    
    Returns:
        Dict: Detailed readiness status with all dependency checks
    """
    health_check_counter.labels('readiness').inc()
    start_time = time.time()
    
    # Perform dependency checks
    db_status = await check_database()
    cache_status = await check_cache()
    system_metrics = get_system_metrics()
    
    # Determine overall status
    dependencies_healthy = (
        db_status['status'] == 'healthy' and 
        cache_status['status'] == 'healthy' and
        system_metrics['cpu_percent'] < 90 and
        system_metrics['memory_percent'] < 90
    )
    
    response = {
        'status': 'ready' if dependencies_healthy else 'not_ready',
        'timestamp': datetime.utcnow().isoformat(),
        'dependencies': {
            'database': db_status,
            'cache': cache_status
        },
        'system_metrics': system_metrics,
        'check_duration': round(time.time() - start_time, 3)
    }
    
    if not dependencies_healthy:
        logger.warning(f"Readiness check failed: {response}")
        raise HTTPException(status_code=503, detail=response)
    
    return response