import React, { memo, useMemo, useCallback } from 'react'; // v18.0.0
import { useSelector } from 'react-redux'; // v8.1.0
import styled from 'styled-components'; // v6.0.0
import Card from '../common/Card';
import { 
  selectIntegrations, 
  selectIntegrationLoading 
} from '../../store/slices/integrationSlice';
import { Integration, IntegrationStatus } from '../../types/integration';

// Props interface
interface IntegrationsWidgetProps {
  className?: string;
  elevation?: number;
  onRefresh?: () => Promise<void>;
}

// Styled components
const StyledCard = styled(Card)`
  min-height: 240px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease-in-out;
  background: ${({ theme }) => theme.colors.background.primary};
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
`;

const WidgetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.base * 2}px;
  padding: ${({ theme }) => theme.spacing.base * 2}px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.h3};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
`;

const RefreshButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary};
  padding: ${({ theme }) => theme.spacing.base}px;
  border-radius: ${({ theme }) => theme.borderRadius.small}px;
  transition: background-color 0.2s ease-in-out;

  &:hover {
    background: ${({ theme }) => theme.colors.background.secondary};
  }
`;

const StatusIndicator = styled.div<{ status: IntegrationStatus }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: ${({ theme }) => theme.spacing.base}px;
  background-color: ${({ theme, status }) => getStatusColor(status, theme)};
  transition: background-color 0.2s ease-in-out;
`;

const IntegrationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.base}px;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.base * 2}px;
`;

const IntegrationItem = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.base}px;
  border-radius: ${({ theme }) => theme.borderRadius.small}px;
  background: ${({ theme }) => theme.colors.background.secondary};
  transition: background-color 0.2s ease-in-out;

  &:hover {
    background: ${({ theme }) => theme.colors.background.tertiary};
  }
`;

const IntegrationInfo = styled.div`
  flex: 1;
  margin-left: ${({ theme }) => theme.spacing.base}px;
`;

const IntegrationName = styled.div`
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text};
`;

const IntegrationMeta = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const HealthScore = styled.div<{ score: number }>`
  padding: ${({ theme }) => theme.spacing.base / 2}px ${({ theme }) => theme.spacing.base}px;
  border-radius: ${({ theme }) => theme.borderRadius.small}px;
  background: ${({ theme, score }) => 
    score >= 80 ? theme.colors.success :
    score >= 60 ? theme.colors.warning :
    theme.colors.error};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

// Helper function to get status color
const getStatusColor = (status: IntegrationStatus, theme: any) => {
  const statusColors = {
    [IntegrationStatus.ACTIVE]: theme.colors.success,
    [IntegrationStatus.INACTIVE]: theme.colors.disabled,
    [IntegrationStatus.ERROR]: theme.colors.error,
    [IntegrationStatus.CONFIGURING]: theme.colors.warning,
    [IntegrationStatus.SYNCING]: theme.colors.info
  };
  return statusColors[status];
};

// Format date helper
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }).format(new Date(date));
};

// Main component
const IntegrationsWidget: React.FC<IntegrationsWidgetProps> = memo(({
  className,
  elevation = 1,
  onRefresh
}) => {
  // Redux selectors
  const integrations = useSelector(selectIntegrations);
  const isLoading = useSelector(selectIntegrationLoading);

  // Memoized sorted integrations
  const sortedIntegrations = useMemo(() => {
    return [...integrations].sort((a, b) => {
      // Sort by status priority and health score
      if (a.status === IntegrationStatus.ERROR && b.status !== IntegrationStatus.ERROR) return -1;
      if (b.status === IntegrationStatus.ERROR && a.status !== IntegrationStatus.ERROR) return 1;
      return b.healthScore - a.healthScore;
    });
  }, [integrations]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isLoading) {
      await onRefresh();
    }
  }, [onRefresh, isLoading]);

  return (
    <StyledCard elevation={elevation} className={className}>
      <WidgetHeader>
        <Title>Integrations</Title>
        <RefreshButton 
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label="Refresh integrations"
        >
          ↻
        </RefreshButton>
      </WidgetHeader>

      <IntegrationList>
        {sortedIntegrations.map((integration) => (
          <IntegrationItem key={integration.id}>
            <StatusIndicator 
              status={integration.status}
              title={`Status: ${integration.status}`}
            />
            <IntegrationInfo>
              <IntegrationName>{integration.name}</IntegrationName>
              <IntegrationMeta>
                {integration.lastSyncAt 
                  ? `Last sync: ${formatDate(integration.lastSyncAt)}`
                  : 'Never synced'}
              </IntegrationMeta>
            </IntegrationInfo>
            <HealthScore score={integration.healthScore}>
              {integration.healthScore}%
            </HealthScore>
          </IntegrationItem>
        ))}

        {integrations.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-secondary)' }}>
            No integrations configured
          </div>
        )}

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-secondary)' }}>
            Loading integrations...
          </div>
        )}
      </IntegrationList>
    </StyledCard>
  );
});

IntegrationsWidget.displayName = 'IntegrationsWidget';

export default IntegrationsWidget;