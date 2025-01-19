import React, { memo, useCallback, useEffect, useState } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { useSelector, useDispatch } from 'react-redux'; // v8.0.0
import debounce from 'lodash/debounce'; // v4.17.21

import Card from '../common/Card';
import { ChatContext } from '../../types/chat';
import { chatActions } from '../../store/slices/chatSlice';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WEBSOCKET_EVENTS } from '../../constants/api';

// Props interface for the ContextPanel component
interface ContextPanelProps {
  className?: string;
  ariaLabel?: string;
}

// Interface for context loading states
interface ContextState {
  isLoading: boolean;
  error: Error | null;
}

// Styled components with MacOS-inspired design
const StyledContextPanel = styled(Card)`
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  min-height: 80px;
  transition: all 0.2s ease-in-out;
  padding: ${({ theme }) => theme.spacing.scale.md};
  margin-bottom: ${({ theme }) => theme.spacing.scale.md};
`;

const ContextItem = styled.div<{ isLoading?: boolean }>`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.scale.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: ${({ isLoading }) => isLoading ? 0.6 : 1};
  transition: opacity 0.2s ease-in-out;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ContextLabel = styled.span`
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  margin-right: ${({ theme }) => theme.spacing.scale.sm};
  color: ${({ theme }) => theme.colors.text};
`;

const LoadingState = styled.div`
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 0.8; }
    100% { opacity: 0.6; }
  }
  animation: pulse 1.5s ease-in-out infinite;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.scale.xs};
  height: 16px;
  width: 120px;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  margin-top: ${({ theme }) => theme.spacing.scale.xs};
`;

// Custom hook for handling context updates
const useContextUpdates = (token: string) => {
  const dispatch = useDispatch();
  
  const handleMessage = useCallback((message: any) => {
    if (message.type === WEBSOCKET_EVENTS.CONTEXT_UPDATE) {
      dispatch(chatActions.setContext(message.data));
    }
  }, [dispatch]);

  const handleError = useCallback((error: any) => {
    console.error('WebSocket error:', error);
  }, []);

  const { connected, error, sendMessage } = useWebSocket({
    url: process.env.REACT_APP_WS_URL || '',
    token,
    onMessage: handleMessage,
    onError: handleError
  });

  return { connected, error, sendMessage };
};

// Debounced context update function
const debouncedContextUpdate = debounce((dispatch, context) => {
  dispatch(chatActions.updateContext(context));
}, 300);

// Main ContextPanel component
const ContextPanel: React.FC<ContextPanelProps> = memo(({ 
  className, 
  ariaLabel = 'Chat context panel'
}) => {
  const dispatch = useDispatch();
  const token = useSelector((state: any) => state.auth.token);
  const context = useSelector((state: any) => state.chat.context);
  const [state, setState] = useState<ContextState>({
    isLoading: !context,
    error: null
  });

  const { connected, error: wsError } = useContextUpdates(token);

  useEffect(() => {
    if (wsError) {
      setState(prev => ({ ...prev, error: new Error(wsError.message) }));
    }
  }, [wsError]);

  useEffect(() => {
    setState(prev => ({ ...prev, isLoading: !context }));
  }, [context]);

  const renderContextItem = (label: string, value: string | undefined) => (
    <ContextItem isLoading={state.isLoading}>
      <ContextLabel>{label}:</ContextLabel>
      {state.isLoading ? (
        <LoadingState />
      ) : (
        value || 'Not set'
      )}
    </ContextItem>
  );

  return (
    <StyledContextPanel
      className={className}
      role="region"
      aria-label={ariaLabel}
      elevation={0}
    >
      {renderContextItem('Project', context?.projectId)}
      {renderContextItem('Template', context?.templateId)}
      {renderContextItem(
        'Active Integrations', 
        context?.activeIntegrations?.length 
          ? `${context.activeIntegrations.length} connected`
          : undefined
      )}
      
      {state.error && (
        <ErrorMessage role="alert">
          Error loading context: {state.error.message}
        </ErrorMessage>
      )}

      {!connected && !state.error && (
        <ErrorMessage role="alert">
          Reconnecting to real-time updates...
        </ErrorMessage>
      )}
    </StyledContextPanel>
  );
});

ContextPanel.displayName = 'ContextPanel';

export default ContextPanel;