import React, { useEffect, useCallback, useState, useMemo } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { format } from 'date-fns'; // v2.30.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0

import Card from '../common/Card';
import { LoadingState } from '../../types/common';

// Activity Types
export enum ActivityType {
  TEMPLATE_UPDATE = 'TEMPLATE_UPDATE',
  INTEGRATION_SYNC = 'INTEGRATION_SYNC',
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  USER_ACTION = 'USER_ACTION',
  SYSTEM_EVENT = 'SYSTEM_EVENT'
}

// Activity Status
export enum ActivityStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Activity Item Interface
export interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: Date;
  user?: string;
  status: ActivityStatus;
}

// Component Props
export interface ActivityWidgetProps {
  maxItems?: number;
  refreshInterval?: number;
  className?: string;
  onActivityClick?: (activity: ActivityItem) => void;
  errorRetryCount?: number;
}

// Styled Components
const ActivityContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.base}px;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.border} transparent`};
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.border};
    border-radius: 3px;
  }
`;

const ActivityItemContainer = styled.div<{ isNew?: boolean }>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.base}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  gap: ${({ theme }) => theme.spacing.base}px;
  transition: background-color 0.2s ease;
  cursor: pointer;
  background-color: ${({ theme, isNew }) => 
    isNew ? `${theme.colors.primary}10` : 'transparent'};

  &:hover {
    background-color: ${({ theme }) => theme.colors.surfaceAlt};
  }
`;

const ActivityIcon = styled.div<{ type: ActivityType }>`
  width: 24px;
  height: 24px;
  color: ${({ theme, type }) => {
    switch (type) {
      case ActivityType.TEMPLATE_UPDATE:
        return theme.colors.primary;
      case ActivityType.INTEGRATION_SYNC:
        return theme.colors.secondary;
      case ActivityType.ANALYSIS_COMPLETE:
        return theme.colors.success;
      case ActivityType.USER_ACTION:
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  }};
  flex-shrink: 0;
`;

const ActivityContent = styled.div`
  flex: 1;
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  line-height: ${({ theme }) => theme.typography.lineHeight.body};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ActivityTime = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  white-space: nowrap;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  padding: ${({ theme }) => theme.spacing.base}px;
  text-align: center;
`;

const LoadingPlaceholder = styled.div`
  height: 48px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  margin: ${({ theme }) => theme.spacing.base}px 0;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 0.8; }
    100% { opacity: 0.6; }
  }
`;

// Utility Functions
const formatActivityTime = (timestamp: Date): string => {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return format(timestamp, 'h:mm a');
  return format(timestamp, 'MMM d');
};

const getActivityIcon = (type: ActivityType): React.ReactNode => {
  // Icon mapping would be implemented here
  return <ActivityIcon type={type} />;
};

// Main Component
export const ActivityWidget: React.FC<ActivityWidgetProps> = ({
  maxItems = 50,
  refreshInterval = 30000,
  className,
  onActivityClick,
  errorRetryCount = 3
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.LOADING);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5
  });

  const fetchActivities = useCallback(async () => {
    try {
      setLoadingState(LoadingState.LOADING);
      // API call would be implemented here
      const response = await fetch('/api/activities');
      const data = await response.json();
      
      setActivities(data.slice(0, maxItems));
      setLoadingState(LoadingState.SUCCESS);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      setError(err as Error);
      setLoadingState(LoadingState.ERROR);
      
      if (retryCount < errorRetryCount) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000 * Math.pow(2, retryCount));
      }
    }
  }, [maxItems, errorRetryCount, retryCount]);

  useEffect(() => {
    fetchActivities();
    
    const intervalId = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchActivities, refreshInterval]);

  const handleActivityClick = useCallback((activity: ActivityItem) => {
    if (onActivityClick) {
      onActivityClick(activity);
    }
  }, [onActivityClick]);

  const renderActivity = useCallback((activity: ActivityItem, isNew: boolean = false) => (
    <ActivityItemContainer
      key={activity.id}
      isNew={isNew}
      onClick={() => handleActivityClick(activity)}
    >
      {getActivityIcon(activity.type)}
      <ActivityContent>
        <div>{activity.description}</div>
        {activity.user && (
          <small>by {activity.user}</small>
        )}
      </ActivityContent>
      <ActivityTime>{formatActivityTime(activity.timestamp)}</ActivityTime>
    </ActivityItemContainer>
  ), [handleActivityClick]);

  const content = useMemo(() => {
    if (loadingState === LoadingState.LOADING && !activities.length) {
      return Array.from({ length: 3 }).map((_, i) => (
        <LoadingPlaceholder key={i} />
      ));
    }

    if (loadingState === LoadingState.ERROR && !activities.length) {
      return (
        <ErrorMessage>
          Failed to load activities. {retryCount < errorRetryCount && 'Retrying...'}
        </ErrorMessage>
      );
    }

    return (
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const activity = activities[virtualRow.index];
          return (
            <div
              key={activity.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderActivity(activity, Date.now() - activity.timestamp.getTime() < 60000)}
            </div>
          );
        })}
      </div>
    );
  }, [activities, loadingState, errorRetryCount, retryCount, rowVirtualizer, renderActivity]);

  return (
    <Card elevation={1} className={className}>
      <ActivityContainer ref={parentRef}>
        {content}
      </ActivityContainer>
    </Card>
  );
};

export default React.memo(ActivityWidget);