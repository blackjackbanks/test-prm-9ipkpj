import React, { useState, useCallback } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import Card from '../common/Card';
import Badge from '../common/Badge';
import { Integration, IntegrationStatus } from '../../types/integration';
import { integrationService } from '../../services/integrations';

// Props interface with comprehensive type safety
interface IntegrationCardProps {
  integration: Integration;
  onSync?: (id: string) => Promise<void>;
  onTest?: (id: string) => Promise<void>;
  onEdit?: (integration: Integration) => void;
}

// Styled components with MacOS-inspired design
const StyledCard = styled(Card)`
  min-width: 300px;
  max-width: 400px;
  margin: ${({ theme }) => theme.spacing.base}px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  will-change: transform;
  transform: scale(1);

  &:hover {
    transform: scale(1.02);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.base}px;
  padding: ${({ theme }) => theme.spacing.base}px;
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.base}px;
  padding: ${({ theme }) => theme.spacing.base}px;
`;

const CardFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.base}px;
  margin-top: ${({ theme }) => theme.spacing.base * 2}px;
  padding: ${({ theme }) => theme.spacing.base}px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.h3};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
`;

const Description = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.body};
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${({ theme }) => `${theme.spacing.scale.xs} ${theme.spacing.scale.sm}`};
  border-radius: 6px;
  border: 1px solid ${({ theme, variant }) => 
    variant === 'primary' ? theme.colors.primary : theme.colors.border};
  background: ${({ theme, variant }) => 
    variant === 'primary' ? theme.colors.primary : 'transparent'};
  color: ${({ theme, variant }) => 
    variant === 'primary' ? '#FFFFFF' : theme.colors.text};
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background: ${({ theme, variant }) => 
      variant === 'primary' ? theme.colors.secondary : theme.colors.surface};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Helper function to determine badge properties based on integration status
const getStatusBadgeProps = (integration: Integration) => {
  const statusMap = {
    [IntegrationStatus.ACTIVE]: { variant: 'success', text: 'Active' },
    [IntegrationStatus.INACTIVE]: { variant: 'default', text: 'Inactive' },
    [IntegrationStatus.ERROR]: { variant: 'error', text: 'Error' },
    [IntegrationStatus.CONFIGURING]: { variant: 'warning', text: 'Configuring' },
    [IntegrationStatus.SYNCING]: { variant: 'info', text: 'Syncing' }
  };

  return statusMap[integration.status] || { variant: 'default', text: 'Unknown' };
};

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  integration,
  onSync,
  onTest,
  onEdit
}) => {
  const [isLoading, setIsLoading] = useState<{
    sync: boolean;
    test: boolean;
  }>({ sync: false, test: false });

  // Handle sync action with error handling
  const handleSync = useCallback(async () => {
    if (!integration.id || isLoading.sync) return;

    setIsLoading(prev => ({ ...prev, sync: true }));
    try {
      const response = await integrationService.syncIntegration(integration.id);
      if (response.success && onSync) {
        await onSync(integration.id);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, sync: false }));
    }
  }, [integration.id, isLoading.sync, onSync]);

  // Handle test action with error handling
  const handleTest = useCallback(async () => {
    if (!integration.id || isLoading.test) return;

    setIsLoading(prev => ({ ...prev, test: true }));
    try {
      const response = await integrationService.testIntegration(integration.id);
      if (response.success && onTest) {
        await onTest(integration.id);
      }
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, test: false }));
    }
  }, [integration.id, isLoading.test, onTest]);

  const statusBadge = getStatusBadgeProps(integration);

  return (
    <StyledCard
      elevation={1}
      role="article"
      aria-label={`${integration.name} integration card`}
    >
      <CardHeader>
        <Title>{integration.name}</Title>
        <Badge
          variant={statusBadge.variant as any}
          aria-label={`Integration status: ${statusBadge.text}`}
        >
          {statusBadge.text}
        </Badge>
      </CardHeader>

      <CardContent>
        <Description>
          Type: {integration.type}
          <br />
          Provider: {integration.provider}
          <br />
          Last Sync: {integration.lastSyncAt 
            ? new Date(integration.lastSyncAt).toLocaleString()
            : 'Never'}
        </Description>

        {integration.lastError && (
          <Description style={{ color: 'error' }}>
            Error: {integration.lastError.message}
          </Description>
        )}
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleTest}
          disabled={isLoading.test || integration.status === IntegrationStatus.SYNCING}
          aria-label="Test integration connection"
        >
          {isLoading.test ? 'Testing...' : 'Test'}
        </Button>
        <Button
          onClick={handleSync}
          disabled={isLoading.sync || integration.status === IntegrationStatus.SYNCING}
          aria-label="Synchronize integration"
        >
          {isLoading.sync ? 'Syncing...' : 'Sync'}
        </Button>
        <Button
          variant="primary"
          onClick={() => onEdit?.(integration)}
          aria-label="Edit integration settings"
        >
          Edit
        </Button>
      </CardFooter>
    </StyledCard>
  );
};

export default IntegrationCard;