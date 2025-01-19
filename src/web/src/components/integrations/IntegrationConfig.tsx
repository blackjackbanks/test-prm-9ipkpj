import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components'; // v6.0.0
import Input from '../common/Input';
import { validateApiKey, validateUrl } from '../../utils/validation';
import { useTheme } from '../../hooks/useTheme';
import { LoadingState, ApiError } from '../../types/common';
import { setItem, getItem } from '../../utils/storage';
import { fadeIn } from '../../styles/animations';

// Type definitions
interface Integration {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  apiUrl: string;
  settings: Record<string, any>;
  active: boolean;
  lastSync?: Date;
}

interface IntegrationTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

interface IntegrationConfigProps {
  integration: Integration;
  onSave: (integration: Integration) => Promise<void>;
  onTest: (result: IntegrationTestResult) => void;
}

interface ConfigFormState {
  apiKey: string;
  apiUrl: string;
  settings: Record<string, any>;
  errors: Record<string, string>;
}

// Styled components with MacOS-inspired design
const ConfigContainer = styled.div`
  animation: ${fadeIn} 0.3s ease-in-out;
  background: var(--color-surface);
  border-radius: 8px;
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-surface);
`;

const ConfigForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 6px;
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  transition: all 0.2s ease-in-out;
  
  ${props => props.variant === 'primary' ? `
    background: var(--color-primary);
    color: #FFFFFF;
    border: none;
    
    &:hover {
      background: var(--color-secondary);
    }
  ` : `
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
    
    &:hover {
      background: var(--color-surface-alt);
    }
  `}

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: var(--color-error);
  font-size: ${props => props.theme.typography.fontSize.small};
  margin-top: var(--spacing-xs);
`;

// Main component
const IntegrationConfig: React.FC<IntegrationConfigProps> = ({
  integration,
  onSave,
  onTest
}) => {
  const { theme } = useTheme();
  const [formState, setFormState] = useState<ConfigFormState>({
    apiKey: integration.apiKey || '',
    apiUrl: integration.apiUrl || '',
    settings: integration.settings || {},
    errors: {}
  });
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [testingState, setTestingState] = useState<LoadingState>(LoadingState.IDLE);

  // Memoized form validation
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formState.apiKey) {
      errors.apiKey = 'API Key is required';
    } else if (!validateApiKey(formState.apiKey)) {
      errors.apiKey = 'Invalid API Key format';
    }

    if (!formState.apiUrl) {
      errors.apiUrl = 'API URL is required';
    } else if (!validateUrl(formState.apiUrl)) {
      errors.apiUrl = 'Invalid URL format';
    }

    setFormState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [formState.apiKey, formState.apiUrl]);

  // Handle input changes with validation
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value,
      errors: {
        ...prev.errors,
        [name]: ''
      }
    }));
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoadingState(LoadingState.LOADING);

    try {
      // Create secure update payload
      const updatedIntegration: Integration = {
        ...integration,
        apiKey: formState.apiKey,
        apiUrl: formState.apiUrl,
        settings: formState.settings
      };

      await onSave(updatedIntegration);

      // Store non-sensitive config data
      setItem(`integration_${integration.id}_config`, {
        lastUpdated: new Date(),
        type: integration.type
      }, false);

      setLoadingState(LoadingState.SUCCESS);
    } catch (error) {
      setLoadingState(LoadingState.ERROR);
      setFormState(prev => ({
        ...prev,
        errors: {
          submit: (error as ApiError).message || 'Failed to save configuration'
        }
      }));
    }
  };

  // Handle integration testing
  const handleTest = async () => {
    if (!validateForm()) {
      return;
    }

    setTestingState(LoadingState.LOADING);

    try {
      // Implement retry logic for flaky integrations
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let testResult: IntegrationTestResult;

      while (retryCount < MAX_RETRIES) {
        testResult = await testIntegration();
        if (testResult.success) {
          break;
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }

      onTest(testResult!);
      setTestingState(LoadingState.SUCCESS);
    } catch (error) {
      setTestingState(LoadingState.ERROR);
      onTest({
        success: false,
        message: (error as ApiError).message || 'Integration test failed'
      });
    }
  };

  // Mock integration test function
  const testIntegration = async (): Promise<IntegrationTestResult> => {
    // Implement actual integration testing logic here
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Integration test successful',
          details: {
            responseTime: 123,
            apiVersion: '2.0'
          }
        });
      }, 1000);
    });
  };

  // Load saved configuration on mount
  useEffect(() => {
    const savedConfig = getItem(`integration_${integration.id}_config`);
    if (savedConfig) {
      setFormState(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          ...savedConfig
        }
      }));
    }
  }, [integration.id]);

  return (
    <ConfigContainer>
      <ConfigForm onSubmit={handleSubmit} noValidate>
        <Input
          name="apiKey"
          type="password"
          value={formState.apiKey}
          onChange={handleInputChange}
          error={formState.errors.apiKey}
          placeholder="Enter API Key"
          aria-label="API Key"
          required
        />

        <Input
          name="apiUrl"
          type="url"
          value={formState.apiUrl}
          onChange={handleInputChange}
          error={formState.errors.apiUrl}
          placeholder="Enter API URL"
          aria-label="API URL"
          required
        />

        <ButtonGroup>
          <Button
            type="button"
            onClick={handleTest}
            disabled={testingState === LoadingState.LOADING}
          >
            {testingState === LoadingState.LOADING ? 'Testing...' : 'Test Connection'}
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={loadingState === LoadingState.LOADING}
          >
            {loadingState === LoadingState.LOADING ? 'Saving...' : 'Save Configuration'}
          </Button>
        </ButtonGroup>

        {formState.errors.submit && (
          <ErrorMessage role="alert">
            {formState.errors.submit}
          </ErrorMessage>
        )}
      </ConfigForm>
    </ConfigContainer>
  );
};

export default IntegrationConfig;