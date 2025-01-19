import React, { useEffect, useRef, useState, useCallback } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { Chart, ChartConfiguration, ChartData } from 'chart.js'; // v4.0.0
import { debounce } from 'lodash'; // v4.17.21
import Card from '../common/Card';
import { api } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { LoadingState } from '../../types/common';

// Enums and Types
export enum MetricType {
  TASKS_COMPLETE = 'TASKS_COMPLETE',
  INTEGRATION_HEALTH = 'INTEGRATION_HEALTH',
  AI_MODEL_STATUS = 'AI_MODEL_STATUS',
  RESPONSE_TIME = 'RESPONSE_TIME'
}

interface MetricsWidgetProps {
  title: string;
  refreshInterval?: number;
  metricType: MetricType;
  onError?: (error: Error) => void;
}

interface MetricData {
  value: number;
  change: number;
  trend: TrendData[];
  metadata: MetricMetadata;
}

interface TrendData {
  timestamp: Date;
  value: number;
}

interface MetricMetadata {
  unit: string;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
}

// Styled Components
const StyledWidget = styled(Card)`
  width: 100%;
  min-height: 300px;
  padding: ${({ theme }) => theme.spacing.base * 2}px;
  background: ${({ theme }) => theme.colors.surface};
  transition: all 0.2s ease-in-out;
`;

const WidgetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.base * 2}px;
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.h3};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const MetricValue = styled.div<{ status: MetricMetadata['status'] }>`
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme, status }) => {
    switch (status) {
      case 'critical':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.success;
    }
  }};
`;

const ChangeIndicator = styled.span<{ isPositive: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  color: ${({ theme, isPositive }) =>
    isPositive ? theme.colors.success : theme.colors.error};
  margin-left: ${({ theme }) => theme.spacing.base}px;
`;

const ChartContainer = styled.div`
  height: 200px;
  margin-top: ${({ theme }) => theme.spacing.base * 2}px;
`;

// Custom Hooks
const useFetchMetricData = (
  metricType: MetricType,
  refreshInterval: number = 30000
) => {
  const [data, setData] = useState<MetricData | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);

  const fetchData = useCallback(async () => {
    try {
      setLoadingState(LoadingState.LOADING);
      const response = await api.get<MetricData>(`/api/v1/metrics/${metricType}`);
      setData(response.data);
      setLoadingState(LoadingState.SUCCESS);
    } catch (error) {
      setLoadingState(LoadingState.ERROR);
      console.error('Failed to fetch metric data:', error);
    }
  }, [metricType]);

  const debouncedFetch = debounce(fetchData, 500);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => {
      clearInterval(interval);
      debouncedFetch.cancel();
    };
  }, [metricType, refreshInterval, debouncedFetch]);

  return { data, loadingState };
};

const useChartConfig = (trendData: TrendData[] = []): ChartConfiguration => {
  const { theme } = useTheme();

  return {
    type: 'line',
    data: {
      labels: trendData.map(d => new Date(d.timestamp).toLocaleTimeString()),
      datasets: [{
        data: trendData.map(d => d.value),
        borderColor: theme.colors.primary,
        backgroundColor: `${theme.colors.primary}20`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: theme.colors.surface,
          titleColor: theme.colors.text,
          bodyColor: theme.colors.textSecondary,
          borderColor: theme.colors.border,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      },
      interaction: {
        intersect: false,
        mode: 'nearest'
      }
    }
  };
};

// Main Component
export const MetricsWidget: React.FC<MetricsWidgetProps> = ({
  title,
  refreshInterval = 30000,
  metricType,
  onError
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const { data, loadingState } = useFetchMetricData(metricType, refreshInterval);

  useEffect(() => {
    if (chartRef.current && data?.trend) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        const config = useChartConfig(data.trend);
        chartInstance.current = new Chart(ctx, config);
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data?.trend]);

  if (loadingState === LoadingState.ERROR) {
    onError?.(new Error(`Failed to load ${metricType} metric`));
    return (
      <StyledWidget elevation={1}>
        <WidgetHeader>
          <Title>{title}</Title>
        </WidgetHeader>
        <div>Failed to load metric data</div>
      </StyledWidget>
    );
  }

  return (
    <StyledWidget elevation={1} role="region" aria-label={`${title} metric widget`}>
      <WidgetHeader>
        <Title>{title}</Title>
      </WidgetHeader>
      
      {loadingState === LoadingState.LOADING && !data ? (
        <div>Loading...</div>
      ) : data ? (
        <>
          <MetricValue status={data.metadata.status}>
            {data.value}
            {data.metadata.unit}
            <ChangeIndicator isPositive={data.change >= 0}>
              {data.change >= 0 ? '↑' : '↓'} {Math.abs(data.change)}%
            </ChangeIndicator>
          </MetricValue>
          
          <ChartContainer>
            <canvas
              ref={chartRef}
              role="img"
              aria-label={`Trend chart for ${title}`}
            />
          </ChartContainer>
        </>
      ) : null}
    </StyledWidget>
  );
};

export default MetricsWidget;