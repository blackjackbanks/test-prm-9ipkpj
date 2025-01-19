"""
Integration tests for context service and API endpoints validating business context data processing,
storage, and retrieval functionality with comprehensive performance and data accuracy checks.

Version: 1.0.0
"""

import pytest
import uuid
import time
import asyncio
from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession

from data.models.context import Context
from services.context_service import ContextService
from utils.exceptions import ValidationException

# Test data constants
TEST_CONTEXT_DATA = {
    "type": "business_analysis",
    "content": {
        "metrics": {
            "revenue": 100000,
            "customers": 50,
            "growth_rate": 15.5
        },
        "insights": [
            "Growth trend identified",
            "Market opportunity detected"
        ],
        "recommendations": [
            "Expand market presence",
            "Increase customer acquisition"
        ]
    }
}

TEST_BATCH_DATA = [
    {
        "type": "market_analysis",
        "content": {
            "market_size": 1000000,
            "competitors": 5,
            "growth_potential": "high"
        }
    },
    {
        "type": "customer_analysis",
        "content": {
            "segments": ["enterprise", "smb"],
            "satisfaction": 4.5,
            "churn_rate": 0.05
        }
    }
]

# Performance thresholds based on technical specifications
PERFORMANCE_THRESHOLDS = {
    "single_context_ms": 3000,  # 3 second max response time
    "batch_process_ms": 5000,   # 5 second max for batch operations
    "search_latency_ms": 1000   # 1 second max for search operations
}

@pytest.fixture
async def test_context_fixture(db_session: AsyncSession, test_user: Dict) -> Context:
    """
    Fixture providing test context data with enhanced validation.
    
    Args:
        db_session: Database session for test
        test_user: Test user data with organization ID
        
    Returns:
        Context: Test context instance with validation metadata
    """
    try:
        # Create test context
        context = Context(
            organization_id=uuid.UUID(test_user["organization_id"]),
            type=TEST_CONTEXT_DATA["type"],
            content=TEST_CONTEXT_DATA["content"]
        )
        
        # Add to database
        db_session.add(context)
        await db_session.commit()
        await db_session.refresh(context)
        
        # Verify data integrity
        assert context.id is not None
        assert context.type == TEST_CONTEXT_DATA["type"]
        assert context.content == TEST_CONTEXT_DATA["content"]
        
        return context
        
    except Exception as e:
        await db_session.rollback()
        pytest.fail(f"Failed to create test context: {str(e)}")

@pytest.mark.asyncio
async def test_process_context(
    db_session: AsyncSession,
    test_user: Dict,
    context_service: ContextService
) -> None:
    """
    Test AI processing of new context data with performance monitoring.
    
    Args:
        db_session: Database session
        test_user: Test user data
        context_service: Context service instance
    """
    try:
        # Start performance timer
        start_time = time.time()
        
        # Process context
        result = await context_service.process_context(
            organization_id=uuid.UUID(test_user["organization_id"]),
            context_data=TEST_CONTEXT_DATA["content"]
        )
        
        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000
        
        # Verify performance
        assert processing_time < PERFORMANCE_THRESHOLDS["single_context_ms"], \
            f"Context processing exceeded threshold: {processing_time}ms"
        
        # Verify result structure
        assert isinstance(result, Context)
        assert result.organization_id == uuid.UUID(test_user["organization_id"])
        assert result.type == TEST_CONTEXT_DATA["type"]
        assert "metrics" in result.content
        assert "insights" in result.content
        assert "recommendations" in result.content
        
        # Verify data accuracy
        assert result.content["metrics"]["revenue"] == TEST_CONTEXT_DATA["content"]["metrics"]["revenue"]
        assert len(result.content["insights"]) > 0
        assert len(result.content["recommendations"]) > 0
        
        # Verify audit trail
        assert result.version == 1
        assert len(result.audit_log) == 1
        assert result.audit_log[0]["action"] == "created"
        
    except Exception as e:
        pytest.fail(f"Context processing test failed: {str(e)}")

@pytest.mark.asyncio
async def test_batch_process_contexts(
    db_session: AsyncSession,
    test_user: Dict,
    context_service: ContextService
) -> None:
    """
    Test batch processing with parallel execution and memory optimization.
    
    Args:
        db_session: Database session
        test_user: Test user data
        context_service: Context service instance
    """
    try:
        # Prepare batch requests
        batch_requests = [
            {
                "organization_id": test_user["organization_id"],
                "context_data": data["content"]
            }
            for data in TEST_BATCH_DATA
        ]
        
        # Start performance timer
        start_time = time.time()
        
        # Process batch
        results = await context_service.batch_process_contexts(batch_requests)
        
        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000
        
        # Verify performance
        assert processing_time < PERFORMANCE_THRESHOLDS["batch_process_ms"], \
            f"Batch processing exceeded threshold: {processing_time}ms"
        
        # Verify results
        assert len(results) == len(TEST_BATCH_DATA)
        for result in results:
            assert isinstance(result, Context)
            assert result.organization_id == uuid.UUID(test_user["organization_id"])
            assert result.type in ["market_analysis", "customer_analysis"]
            assert result.version == 1
            assert len(result.audit_log) == 1
        
        # Verify data consistency
        market_analysis = next(r for r in results if r.type == "market_analysis")
        assert market_analysis.content["market_size"] == TEST_BATCH_DATA[0]["content"]["market_size"]
        
        customer_analysis = next(r for r in results if r.type == "customer_analysis")
        assert customer_analysis.content["satisfaction"] == TEST_BATCH_DATA[1]["content"]["satisfaction"]
        
    except Exception as e:
        pytest.fail(f"Batch processing test failed: {str(e)}")

@pytest.mark.asyncio
async def test_search_contexts(
    db_session: AsyncSession,
    test_context_fixture: Context,
    context_service: ContextService
) -> None:
    """
    Test context search with performance and security validation.
    
    Args:
        db_session: Database session
        test_context_fixture: Test context instance
        context_service: Context service instance
    """
    try:
        # Prepare search criteria
        search_criteria = {
            "metrics.revenue": TEST_CONTEXT_DATA["content"]["metrics"]["revenue"]
        }
        
        # Start performance timer
        start_time = time.time()
        
        # Search contexts
        results = await context_service.search_contexts(
            search_criteria=search_criteria,
            organization_id=test_context_fixture.organization_id
        )
        
        # Calculate search time
        search_time = (time.time() - start_time) * 1000
        
        # Verify performance
        assert search_time < PERFORMANCE_THRESHOLDS["search_latency_ms"], \
            f"Search operation exceeded threshold: {search_time}ms"
        
        # Verify results
        assert len(results) > 0
        assert any(r.id == test_context_fixture.id for r in results)
        
        # Verify security filtering
        for result in results:
            assert result.organization_id == test_context_fixture.organization_id
            assert not result.is_deleted
            
        # Test pagination
        paginated_results = await context_service.search_contexts(
            search_criteria=search_criteria,
            organization_id=test_context_fixture.organization_id,
            search_options={"page_size": 1, "page_number": 1}
        )
        assert len(paginated_results) <= 1
        
        # Test invalid search
        with pytest.raises(ValidationException):
            await context_service.search_contexts(
                search_criteria={"invalid_field": "value"},
                organization_id=test_context_fixture.organization_id
            )
            
    except Exception as e:
        pytest.fail(f"Context search test failed: {str(e)}")