"""
Unit tests for service layer implementations including context, integration, organization,
template and user services with comprehensive test coverage and performance validation.

Version: 1.0.0
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, AsyncMock, patch
import time
from uuid import UUID
from datetime import datetime

from services.context_service import ContextService
from services.integration_service import IntegrationService
from utils.exceptions import ValidationException, NotFoundException
from utils.constants import IntegrationTypes

# Test constants
TEST_ORGANIZATION_ID = UUID('12345678-1234-5678-1234-567812345678')
TEST_INTEGRATION_ID = UUID('87654321-4321-8765-4321-876543210987')
PERFORMANCE_THRESHOLD = 3.0  # Maximum allowed response time in seconds

class TestContextService:
    """Test suite for ContextService implementation with performance validation."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Set up test dependencies with mocked components."""
        # Mock repository with async methods
        self._repository = Mock()
        self._repository.get_by_id = AsyncMock()
        self._repository.get_by_organization = AsyncMock()
        self._repository.create = AsyncMock()
        self._repository.search_content = AsyncMock()

        # Mock processor with performance tracking
        self._processor = Mock()
        self._processor.process_context = AsyncMock()

        # Initialize service with mocked dependencies
        self._service = ContextService(
            repository=self._repository,
            processor=self._processor,
            logger=Mock()
        )

    @pytest.mark.asyncio
    async def test_get_context_success(self):
        """Test successful context retrieval with performance validation."""
        # Arrange
        context_id = UUID('12345678-1234-5678-1234-567812345678')
        test_context = {
            'id': context_id,
            'organization_id': TEST_ORGANIZATION_ID,
            'type': 'business_analysis',
            'content': {'metrics': {'revenue': 100000}}
        }
        self._repository.get_by_id.return_value.__aenter__.return_value = test_context

        # Act
        start_time = time.time()
        result = await self._service.get_context(context_id)
        response_time = time.time() - start_time

        # Assert
        assert result == test_context
        assert response_time < PERFORMANCE_THRESHOLD
        self._repository.get_by_id.assert_called_once_with(str(context_id))

    @pytest.mark.asyncio
    async def test_get_context_not_found(self):
        """Test context retrieval with invalid ID."""
        # Arrange
        context_id = UUID('99999999-9999-9999-9999-999999999999')
        self._repository.get_by_id.return_value.__aenter__.return_value = None

        # Act & Assert
        with pytest.raises(NotFoundException):
            await self._service.get_context(context_id)
        self._repository.get_by_id.assert_called_once_with(str(context_id))

    @pytest.mark.asyncio
    async def test_process_context_success(self):
        """Test successful context processing with performance validation."""
        # Arrange
        test_data = {
            'business_metrics': {'revenue': 100000},
            'market_data': {'competitors': 5}
        }
        processed_result = {
            'insights': {
                'type': 'business_analysis',
                'recommendations': ['Increase market share']
            }
        }
        self._processor.process_context.return_value = processed_result
        self._repository.create.return_value.__aenter__.return_value = {
            'id': UUID('12345678-1234-5678-1234-567812345678'),
            'organization_id': TEST_ORGANIZATION_ID,
            'type': 'business_analysis',
            'content': processed_result['insights']
        }

        # Act
        start_time = time.time()
        result = await self._service.process_context(
            TEST_ORGANIZATION_ID,
            test_data,
            {'depth': 'detailed'}
        )
        response_time = time.time() - start_time

        # Assert
        assert result['type'] == 'business_analysis'
        assert 'recommendations' in result['content']
        assert response_time < PERFORMANCE_THRESHOLD
        self._processor.process_context.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_context_error(self):
        """Test context processing with error handling."""
        # Arrange
        test_data = {'invalid_data': True}
        self._processor.process_context.side_effect = Exception("Processing failed")

        # Act & Assert
        with pytest.raises(ValidationException):
            await self._service.process_context(
                TEST_ORGANIZATION_ID,
                test_data
            )
        self._processor.process_context.assert_called_once()

class TestIntegrationService:
    """Test suite for IntegrationService implementation with performance validation."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Set up test dependencies with mocked components."""
        # Mock repository with async methods
        self._repository = Mock()
        self._repository.get_by_organization = AsyncMock()
        self._repository.create = AsyncMock()
        self._repository.update = AsyncMock()

        # Mock sync manager with performance tracking
        self._sync_manager = Mock()
        self._sync_manager.async_validate_config = AsyncMock()
        self._sync_manager.async_schedule_sync = AsyncMock()
        self._sync_manager.async_get_sync_status = AsyncMock()

        # Initialize service with mocked dependencies
        self._service = IntegrationService(
            repository=self._repository,
            sync_manager=self._sync_manager
        )

    @pytest.mark.asyncio
    async def test_get_organization_integrations_success(self):
        """Test successful retrieval of organization integrations with performance validation."""
        # Arrange
        test_integrations = [
            {
                'id': TEST_INTEGRATION_ID,
                'organization_id': TEST_ORGANIZATION_ID,
                'type': IntegrationTypes.CRM.value,
                'provider': 'salesforce',
                'config': {'instance_url': 'https://test.salesforce.com'},
                'active': True
            }
        ]
        self._repository.get_by_organization.return_value.__aenter__.return_value = test_integrations
        self._sync_manager.async_get_sync_status.return_value = {'status': 'healthy'}

        # Act
        start_time = time.time()
        result = await self._service.async_get_organization_integrations(str(TEST_ORGANIZATION_ID))
        response_time = time.time() - start_time

        # Assert
        assert len(result) == 1
        assert result[0]['id'] == TEST_INTEGRATION_ID
        assert result[0]['health_status']['status'] == 'healthy'
        assert response_time < PERFORMANCE_THRESHOLD
        self._repository.get_by_organization.assert_called_once_with(str(TEST_ORGANIZATION_ID))

    @pytest.mark.asyncio
    async def test_get_organization_integrations_empty(self):
        """Test retrieval with no integrations."""
        # Arrange
        self._repository.get_by_organization.return_value.__aenter__.return_value = []

        # Act & Assert
        with pytest.raises(NotFoundException):
            await self._service.async_get_organization_integrations(str(TEST_ORGANIZATION_ID))
        self._repository.get_by_organization.assert_called_once_with(str(TEST_ORGANIZATION_ID))

    @pytest.mark.asyncio
    async def test_configure_integration_success(self):
        """Test successful integration configuration with performance validation."""
        # Arrange
        test_config = {
            'provider': 'salesforce',
            'credentials': {
                'client_id': 'test_client',
                'client_secret': 'test_secret'
            }
        }
        self._sync_manager.async_validate_config.return_value = test_config
        self._repository.create.return_value.__aenter__.return_value = {
            'id': TEST_INTEGRATION_ID,
            'organization_id': TEST_ORGANIZATION_ID,
            'type': IntegrationTypes.CRM.value,
            'config': test_config,
            'active': True
        }
        self._sync_manager.async_schedule_sync.return_value = {'status': 'scheduled'}

        # Act
        start_time = time.time()
        result = await self._service.async_configure_integration(
            str(TEST_ORGANIZATION_ID),
            IntegrationTypes.CRM,
            test_config
        )
        response_time = time.time() - start_time

        # Assert
        assert result['id'] == TEST_INTEGRATION_ID
        assert result['type'] == IntegrationTypes.CRM.value
        assert result['sync_status']['status'] == 'scheduled'
        assert response_time < PERFORMANCE_THRESHOLD
        self._sync_manager.async_validate_config.assert_called_once()
        self._sync_manager.async_schedule_sync.assert_called_once()

    @pytest.mark.asyncio
    async def test_configure_integration_invalid(self):
        """Test configuration with invalid data."""
        # Arrange
        invalid_config = {
            'provider': 'unsupported_provider'
        }

        # Act & Assert
        with pytest.raises(ValidationException):
            await self._service.async_configure_integration(
                str(TEST_ORGANIZATION_ID),
                IntegrationTypes.CRM,
                invalid_config
            )
        self._sync_manager.async_validate_config.assert_not_called()