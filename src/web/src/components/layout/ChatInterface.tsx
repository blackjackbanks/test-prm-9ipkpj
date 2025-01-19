import React, { useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';

// Internal imports
import ChatWindow from '../chat/ChatWindow';
import { useWebSocket } from '../../hooks/useWebSocket';
import { chatActions } from '../../store/slices/chatSlice';
import ErrorBoundary from '../common/ErrorBoundary';
import type { Message } from '../../types/chat';

// Styled components with MacOS-inspired design
const ChatInterfaceContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.surface};
  transition: all 0.2s ease-in-out;
  position: relative;
  min-height: 400px;
  max-height: calc(100vh - ${({ theme }) => theme.spacing.scale.xxl});
  padding: ${({ theme }) => theme.spacing.scale.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding: ${({ theme }) => theme.spacing.scale.sm};
    border-radius: 0;
    height: 100vh;
    max-height: none;
  }

  /* Accessibility - Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ConnectionStatus = styled.div<{ isConnected: boolean }>`
  position: absolute;
  top: ${({ theme }) => theme.spacing.scale.sm};
  right: ${({ theme }) => theme.spacing.scale.sm};
  padding: ${({ theme }) => theme.spacing.scale.xs} ${({ theme }) => theme.spacing.scale.sm};
  background: ${({ isConnected, theme }) => 
    isConnected ? theme.colors.success : theme.colors.error};
  color: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.spacing.scale.xs};
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  opacity: 0.8;
  transition: opacity 0.2s ease-in-out;
  z-index: 100;

  &:hover {
    opacity: 1;
  }
`;

const ChatInterface: React.FC = () => {
  const dispatch = useDispatch();

  // Initialize WebSocket connection with error handling and reconnection
  const {
    connected,
    error: wsError,
    sendMessage,
    reconnect,
    messageQueue
  } = useWebSocket({
    url: process.env.REACT_APP_WS_URL || '',
    token: localStorage.getItem('accessToken') || '',
    onMessage: (message: Message) => {
      dispatch(chatActions.addMessage(message));
    },
    onError: (error) => {
      dispatch(chatActions.setError(error.message));
    }
  });

  // Handle WebSocket message processing with offline support
  const handleWebSocketMessage = useCallback(async (message: Message) => {
    try {
      if (connected) {
        await sendMessage(message);
      } else {
        dispatch(chatActions.queueOfflineMessage(message));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      dispatch(chatActions.setError('Failed to send message. Please try again.'));
    }
  }, [connected, sendMessage, dispatch]);

  // Process offline message queue when connection is restored
  useEffect(() => {
    if (connected && messageQueue.length > 0) {
      const syncMessages = async () => {
        try {
          await dispatch(chatActions.syncOfflineMessages());
          messageQueue.forEach(message => {
            handleWebSocketMessage(message);
          });
        } catch (error) {
          console.error('Failed to sync offline messages:', error);
        }
      };
      syncMessages();
    }
  }, [connected, messageQueue, handleWebSocketMessage, dispatch]);

  // Render error boundary with fallback UI
  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-container">
          <h3>Chat Error</h3>
          <p>Unable to load chat interface. Please refresh the page.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      }
    >
      <ChatInterfaceContainer
        role="main"
        aria-label="Chat interface"
      >
        <ConnectionStatus 
          isConnected={connected}
          role="status"
          aria-live="polite"
        >
          {connected ? 'Connected' : 'Reconnecting...'}
        </ConnectionStatus>

        <ChatWindow
          onSend={handleWebSocketMessage}
          onReconnect={reconnect}
          connected={connected}
          error={wsError}
          theme={localStorage.getItem('theme') as 'light' | 'dark' || 'light'}
          locale={navigator.language}
          accessibility={{
            screenReader: true,
            highContrast: window.matchMedia('(prefers-contrast: high)').matches,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          }}
        />
      </ChatInterfaceContainer>
    </ErrorBoundary>
  );
};

export default ChatInterface;