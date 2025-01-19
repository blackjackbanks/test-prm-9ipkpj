import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { useAnalytics } from '@mixpanel/browser'; // v2.45.0

import DashboardGrid from '../components/dashboard/DashboardGrid';
import AppLayout from '../components/layout/AppLayout';
import useBreakpoint from '../hooks/useBreakpoint';
import { LoadingState } from '../types/common';
import { selectAuthLoadingState } from '../store/slices/authSlice';
import { selectTemplates } from '../store/slices/templateSlice';
import { selectIntegrations } from '../store/slices/integrationSlice';

// Styled components with MacOS-inspired design
const DashboardContainer = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.lg};
  padding: ${({ theme }) => theme.spacing.scale.lg};
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  transition: all 0.2s ease-in-out;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding: ${({ theme }) => theme.spacing.scale.md};
    gap: ${({ theme }) => theme.spacing.scale.md};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const DashboardHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.scale.lg};
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: ${({ theme }) => theme.typography.fontSize.h1};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const LoadingPlaceholder = styled.div`
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 0.8; }
    100% { opacity: 0.6; }
  }
`;

// Dashboard component
const Dashboard: React.FC = () => {
  const dispatch = useDispatch();
  const breakpoint = useBreakpoint();
  const analytics = useAnalytics();
  
  // Redux selectors
  const authLoading = useSelector(selectAuthLoadingState);
  const templates = useSelector(selectTemplates);
  const integrations = useSelector(selectIntegrations);

  // Local state
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoized initial widgets configuration
  const initialWidgets = useMemo(() => [
    {
      id: 'metrics',
      type: 'metrics',
      title: 'Business Metrics',
      refreshInterval: 30000,
      metricType: 'TASKS_COMPLETE'
    },
    {
      id: 'activity',
      type: 'activity',
      title: 'Recent Activity',
      maxItems: 50,
      refreshInterval: 30000
    },
    {
      id: 'integrations',
      type: 'integrations',
      title: 'Active Integrations',
      elevation: 1
    },
    {
      id: 'templates',
      type: 'templates',
      title: 'Recent Templates'
    }
  ], []);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayout: any) => {
    setLayout(newLayout.type);
    analytics.track('Dashboard.LayoutChanged', {
      layout: newLayout.type,
      breakpoint,
      widgetCount: initialWidgets.length
    });
  }, [analytics, breakpoint, initialWidgets.length]);

  // Track dashboard initialization
  useEffect(() => {
    if (!isInitialized && authLoading === LoadingState.SUCCESS) {
      analytics.track('Dashboard.Initialized', {
        templateCount: templates.length,
        integrationCount: integrations.length,
        breakpoint
      });
      setIsInitialized(true);
    }
  }, [analytics, authLoading, breakpoint, integrations.length, isInitialized, templates.length]);

  // Handle error states
  const handleError = useCallback((error: Error) => {
    console.error('Dashboard error:', error);
    analytics.track('Dashboard.Error', {
      error: error.message,
      stack: error.stack
    });
  }, [analytics]);

  if (authLoading === LoadingState.LOADING) {
    return (
      <AppLayout>
        <DashboardContainer>
          <LoadingPlaceholder role="progressbar" aria-label="Loading dashboard" />
        </DashboardContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <DashboardContainer role="main" aria-label="Dashboard">
        <DashboardHeader>
          <Title>Dashboard</Title>
        </DashboardHeader>

        <DashboardGrid
          initialWidgets={initialWidgets}
          onLayoutChange={handleLayoutChange}
          onError={handleError}
          loadingStrategy={breakpoint === 'mobile' ? 'lazy' : 'eager'}
          aria-label="Dashboard widgets"
        />
      </DashboardContainer>
    </AppLayout>
  );
};

export default Dashboard;