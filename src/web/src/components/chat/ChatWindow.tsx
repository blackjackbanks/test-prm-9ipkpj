import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ContextPanel from './ContextPanel';
import { useWebSocket } from '../../hooks/useWebSocket';
import { chatActions } from '../../store/slices/chatSlice';
import type { Message, MessageStatus, ChatContext } from '../../types/chat';

// Styled components with MacOS-inspired design
const ChatContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: ${({ theme }) => theme.colors.background};
  border-radius: 12px;
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.surface};
  position: relative;
  will-change: transform;

  @media (max-width: 768px) {
    border-radius: 0;
    height: 100vh;
  }
`;

const ChatContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  gap: ${({ theme }) => theme.spacing.scale.sm};
  padding: ${({ theme }) => theme.spacing.scale.md};
`;

const ErrorFallback = styled.div`
  padding: ${({ theme }) => theme.spacing.scale.md};
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
`;

// Props interface
interface ChatWindowProps {
  className?: string;
  onClose?: () => void;
  theme: 'light' | 'dark';
  locale: string;
  accessibility: {
    screenReader: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
  };
}

// Animation variants
const containerVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 }
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  className,
  onClose,
  theme,
  locale,
  accessibility
}) => {
  const dispatch = useDispatch();
  const token = useSelector((state: any) => state.auth.token);
  const messages = useSelector((state: any) => state.chat.messages);
  const context = useSelector((state: any) => state.chat.context);
  
  const [isComposing, setIsComposing] = useState(false);
  const lastMessageRef = useRef<string | null>(null);
  
  // Initialize WebSocket connection
  const {
    connected,
    error: wsError,
    sendMessage: sendWebSocketMessage,
    messageQueue
  } = useWebSocket({
    url: process.env.REACT_APP_WS_URL || '',
    token,
    onMessage: (message: Message) => {
      dispatch(chatActions.addMessage(message));
    },
    onError: (error) => {
      dispatch(chatActions.setError(error.message));
    }
  });

  // Handle message sending with offline support
  const handleSendMessage = useCallback(async (
    content: string,
    attachments: File[] = [],
    metadata = {}
  ) => {
    if (!content.trim() && attachments.length === 0) return;

    const message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
      type: 'USER',
      content: content.trim(),
      attachments: [],
      status: MessageStatus.SENDING,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        context: context
      }
    };

    try {
      if (connected) {
        await sendWebSocketMessage(message);
      } else {
        dispatch(chatActions.addMessage({
          ...message,
          status: MessageStatus.ERROR
        }));
      }
    } catch (error) {
      dispatch(chatActions.setError('Failed to send message'));
    }
  }, [connected, sendWebSocketMessage, dispatch, context]);

  // Handle composition events for IME input
  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  // Process message queue when connection is restored
  useEffect(() => {
    if (connected && messageQueue.length > 0) {
      messageQueue.forEach(message => {
        sendWebSocketMessage(message);
      });
    }
  }, [connected, messageQueue, sendWebSocketMessage]);

  // Announce new messages to screen readers
  useEffect(() => {
    if (accessibility.screenReader && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id !== lastMessageRef.current) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `New message: ${lastMessage.content}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
        lastMessageRef.current = lastMessage.id;
      }
    }
  }, [messages, accessibility.screenReader]);

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <ErrorFallback>
          <h3>Something went wrong</h3>
          <pre>{error.message}</pre>
        </ErrorFallback>
      )}
    >
      <AnimatePresence>
        <ChatContainer
          className={className}
          variants={containerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
          role="region"
          aria-label="Chat window"
        >
          <ContextPanel
            ariaLabel="Chat context information"
          />
          
          <ChatContent>
            <MessageList
              messages={messages}
              onMessageVisible={(messageId) => {
                dispatch(chatActions.updateMessageStatus({
                  id: messageId,
                  status: MessageStatus.DELIVERED
                }));
              }}
              loading={!connected}
            />
            
            <MessageInput
              onSend={handleSendMessage}
              disabled={!connected}
              maxAttachments={5}
              placeholder={connected ? "Type a message..." : "Reconnecting..."}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
            />
          </ChatContent>
        </ChatContainer>
      </AnimatePresence>
    </ErrorBoundary>
  );
};

export default ChatWindow;