import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components'; // v6.0.0
import { VirtualGrid } from 'react-virtual'; // v3.0.0
import IntegrationCard from './IntegrationCard';
import { Integration, IntegrationType } from '../../types/integration';
import { integrationService } from '../../services/integrations';
import Select from '../common/Select';
import useBreakpoint from '../../hooks/useBreakpoint';
import ErrorBoundary from '../common/ErrorBoundary';
import { fadeIn } from '../../styles/animations';

// Styled components with MacOS-inspired design
const ListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing.base * 2}px;
  padding: ${({ theme }) => theme.spacing.base * 2}px;
  min-height: 200px;
  position: relative;
  animation: ${fadeIn} 0.3s ${({ theme }) => theme.colors.smooth};
`;

const FilterContainer = styled.div<{ isMobile: boolean }>`
  display: flex;
  flex-direction: ${({ isMobile }) => isMobile ? 'column' : 'row'};
  gap: ${({ theme }) => theme.spacing.base * 2}px;
  margin-bottom: ${({ theme }) => theme.spacing.base * 2}px;
  padding: ${({ theme }) => theme.spacing.base * 2}px;
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.base}px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.base * 4}px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// Props interface
interface IntegrationListProps {
  onEdit: (integration: Integration) => void;
  onSync: (integrationId: string) => Promise<void>;
  onTest: (integrationId: string) => Promise<void>;
}

// Filter state interface
interface FilterState {
  type: IntegrationType | 'all';
  status: 'active' | 'inactive' | 'all';
  search: string;
}

// Custom hook for managing integrations data
const useIntegrations = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await integrationService.getIntegrations();
      if (response.success) {
        setIntegrations(response.data);
      } else {
        throw new Error('Failed to fetch integrations');
      }
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching integrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return { integrations, loading, error, refetch: fetchIntegrations };
};

// Memoized filter function
const filterIntegrations = (integrations: Integration[], filters: FilterState): Integration[] => {
  return integrations.filter(integration => {
    const typeMatch = filters.type === 'all' || integration.type === filters.type;
    const statusMatch = filters.status === 'all' || 
      (filters.status === 'active' ? integration.active : !integration.active);
    const searchMatch = !filters.search || 
      integration.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      integration.provider.toLowerCase().includes(filters.search.toLowerCase());
    
    return typeMatch && statusMatch && searchMatch;
  });
};

export const IntegrationList: React.FC<IntegrationListProps> = ({
  onEdit,
  onSync,
  onTest
}) => {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    status: 'all',
    search: ''
  });

  const { integrations, loading, error, refetch } = useIntegrations();

  const filteredIntegrations = useMemo(() => 
    filterIntegrations(integrations, filters),
    [integrations, filters]
  );

  const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    ...Object.values(IntegrationType).map(type => ({
      value: type,
      label: type
    }))
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  if (error) {
    return (
      <EmptyState role="alert">
        Error loading integrations. Please try again.
      </EmptyState>
    );
  }

  return (
    <ErrorBoundary>
      <FilterContainer isMobile={isMobile}>
        <Select
          options={typeOptions}
          value={filters.type}
          onChange={(value) => handleFilterChange('type', value as string)}
          placeholder="Filter by type"
          aria-label="Filter integrations by type"
        />
        <Select
          options={statusOptions}
          value={filters.status}
          onChange={(value) => handleFilterChange('status', value as string)}
          placeholder="Filter by status"
          aria-label="Filter integrations by status"
        />
        <Select
          options={[]}
          value={filters.search}
          onChange={(value) => handleFilterChange('search', value as string)}
          placeholder="Search integrations..."
          async
          onSearch={(query) => handleFilterChange('search', query)}
          aria-label="Search integrations"
        />
      </FilterContainer>

      <ListContainer role="grid" aria-label="Integration list">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} aria-hidden="true" style={{ height: 200 }} />
          ))
        ) : filteredIntegrations.length === 0 ? (
          <EmptyState>
            No integrations found matching your filters.
          </EmptyState>
        ) : (
          filteredIntegrations.map(integration => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onEdit={onEdit}
              onSync={onSync}
              onTest={onTest}
            />
          ))
        )}
      </ListContainer>
    </ErrorBoundary>
  );
};

export default IntegrationList;