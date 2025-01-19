import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import Button from '../common/Button';
import { integrationService } from '../../services/integrations';
import type { Integration, IntegrationStatus } from '../../types/integration';

// Version comments for external dependencies
// react@18.0.0
// styled-components@6.0.0

/**
 * Enum for tracking test execution status with enhanced states
 */
enum TestStatus {
  IDLE = 'IDLE',
  TESTING = 'TESTING',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RETRYING = 'RETRYING'
}

/**
 * Props interface for the IntegrationTest component
 */
interface IntegrationTestProps {
  integration: Integration;
  onTestComplete: (success: boolean, result: { message: string; details?: Record<string, unknown> }) => void;
  onError: (error: Error) => void;
}

// Styled components with MacOS-inspired design system
const TestContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background-color: var(--color-surface);
  border-radius: 8px;
  box-shadow: var(--shadow-surface);
  transition: all 0.2s ease-in-out;

  &:hover {
    box-shadow: var(--shadow-modal);
  }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

const StatusIndicator = styled.div<{ status: TestStatus }>`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-family: var(--font-family-primary);
  font-size: var(--font-size-body);
  color: var(--color-text);
`;

const StatusDot = styled.div<{ status: TestStatus }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background-color 0.2s ease-in-out;
  animation: ${({ status }) => status === TestStatus.TESTING ? pulse : 'none'} 1.5s infinite;

  background-color: ${({ status, theme }) => {
    switch (status) {
      case TestStatus.IDLE:
        return theme.colors.disabled;
      case TestStatus.TESTING:
        return theme.colors.warning;
      case TestStatus.SUCCESS:
        return theme.colors.success;
      case TestStatus.FAILURE:
        return theme.colors.error;
      case TestStatus.RETRYING:
        return theme.colors.info;
      default:
        return theme.colors.disabled;
    }
  }};
`;

const ResultMessage = styled.div<{ success?: boolean }>`
  font-family: var(--font-family-primary);
  font-size: var(--font-size-body);
  color: ${({ success, theme }) => 
    success ? theme.colors.success : theme.colors.error};
  margin-top: var(--spacing-sm);
`;

/**
 * IntegrationTest component for testing integration configurations
 * with enhanced error handling and accessibility features
 */
export const IntegrationTest: React.FC<IntegrationTestProps> = ({
  integration,
  onTestComplete,
  onError
}) => {
  const [status, setStatus] = useState<TestStatus>(TestStatus.IDLE);
  const [message, setMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const statusRef = useRef<HTMLDivElement>(null);
  const maxRetries = 3;

  // Reset status when integration changes
  useEffect(() => {
    setStatus(TestStatus.IDLE);
    setMessage('');
    setRetryCount(0);
  }, [integration.id]);

  // Update ARIA live region for accessibility
  useEffect(() => {
    if (statusRef.current) {
      statusRef.current.setAttribute('aria-live', 'polite');
    }
  }, [status, message]);

  /**
   * Handles the test execution with retry logic
   */
  const handleTestClick = useCallback(async () => {
    if (status === TestStatus.TESTING) return;

    try {
      setStatus(TestStatus.TESTING);
      setMessage('Testing integration...');

      // Validate integration status
      if (integration.status === IntegrationStatus.SYNCING) {
        throw new Error('Integration is currently syncing. Please try again later.');
      }

      const response = await integrationService.testIntegration(integration.id);

      if (response.success) {
        setStatus(TestStatus.SUCCESS);
        setMessage('Integration test completed successfully');
        onTestComplete(true, { 
          message: 'Integration test successful',
          details: response.data
        });
      } else {
        throw new Error('Integration test failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      if (retryCount < maxRetries) {
        setStatus(TestStatus.RETRYING);
        setMessage(`Test failed, retrying... (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        
        // Retry after delay
        setTimeout(() => {
          handleTestClick();
        }, 2000);
      } else {
        setStatus(TestStatus.FAILURE);
        setMessage(`Test failed: ${errorMessage}`);
        onTestComplete(false, { message: errorMessage });
        onError(new Error(errorMessage));
      }
    }
  }, [integration.id, integration.status, retryCount, onTestComplete, onError]);

  const getStatusText = useCallback(() => {
    switch (status) {
      case TestStatus.IDLE:
        return 'Ready to test';
      case TestStatus.TESTING:
        return 'Testing integration...';
      case TestStatus.SUCCESS:
        return 'Test successful';
      case TestStatus.FAILURE:
        return 'Test failed';
      case TestStatus.RETRYING:
        return `Retrying test (${retryCount}/${maxRetries})`;
      default:
        return '';
    }
  }, [status, retryCount]);

  return (
    <TestContainer role="region" aria-label="Integration Test">
      <StatusIndicator ref={statusRef} status={status}>
        <StatusDot status={status} />
        <span>{getStatusText()}</span>
      </StatusIndicator>

      <Button
        variant="primary"
        size="medium"
        loading={status === TestStatus.TESTING || status === TestStatus.RETRYING}
        disabled={integration.status === IntegrationStatus.SYNCING}
        onClick={handleTestClick}
        aria-label="Test Integration"
      >
        {status === TestStatus.IDLE ? 'Test Integration' : 'Run Test Again'}
      </Button>

      {message && (
        <ResultMessage 
          success={status === TestStatus.SUCCESS}
          role="status"
          aria-live="polite"
        >
          {message}
        </ResultMessage>
      )}
    </TestContainer>
  );
};

export default IntegrationTest;