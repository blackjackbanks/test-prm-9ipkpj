import React, { useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Message, MessageType, MessageStatus } from '../../types/chat';
import Loader from '../common/Loader';
import { fadeIn } from '../../styles/animations';

// Styled components with MacOS-inspired design
const MessageListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  background-color: ${props => props.theme.colors.background};
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  position: relative;
  will-change: transform;

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const MessageItem = styled.div<{ type: MessageType }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 12px;
  background-color: ${props => 
    props.type === MessageType.USER 
      ? props.theme.colors.primary + '10' 
      : props.theme.colors.surface};
  animation: ${fadeIn} 0.2s ease-out;
  max-width: 85%;
  align-self: ${props => props.type === MessageType.USER ? 'flex-end' : 'flex-start'};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const MessageContent = styled.div`
  font-size: 14px;
  line-height: 1.5;
  color: ${props => props.theme.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
`;

const AttachmentList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const MessageStatus = styled.span<{ status: MessageStatus }>`
  font-size: 12px;
  color: ${props => 
    props.status === MessageStatus.ERROR 
      ? props.theme.colors.error 
      : props.theme.colors.textSecondary};
  margin-top: 4px;
  align-self: flex-end;
`;

interface MessageListProps {
  /** Array of messages to display */
  messages: Message[];
  /** Callback when a message becomes visible */
  onMessageVisible?: (messageId: string) => void;
  /** Loading state indicator */
  loading?: boolean;
  /** CSS class name for custom styling */
  className?: string;
}

const ESTIMATED_MESSAGE_HEIGHT = 80;
const OVERSCAN_COUNT = 5;

const MessageList: React.FC<MessageListProps> = ({
  messages,
  onMessageVisible,
  loading = false,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Initialize virtualizer for performance
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback(() => ESTIMATED_MESSAGE_HEIGHT, []),
    overscan: OVERSCAN_COUNT,
  });

  // Set up intersection observer for message visibility tracking
  useEffect(() => {
    if (!onMessageVisible) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) onMessageVisible(messageId);
          }
        });
      },
      { threshold: 0.5 }
    );

    return () => observerRef.current?.disconnect();
  }, [onMessageVisible]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      const shouldAutoScroll = 
        containerRef.current.scrollHeight - containerRef.current.scrollTop ===
        containerRef.current.clientHeight;

      if (shouldAutoScroll) {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      }
    }
  }, [messages.length, virtualizer]);

  const renderMessage = useCallback((message: Message) => (
    <MessageItem
      type={message.type}
      data-message-id={message.id}
      role="listitem"
      aria-label={`${message.type.toLowerCase()} message`}
    >
      <MessageContent>{message.content}</MessageContent>
      
      {message.attachments.length > 0 && (
        <AttachmentList role="list" aria-label="attachments">
          {message.attachments.map(attachment => (
            <div key={attachment.id} role="listitem">
              {attachment.name}
            </div>
          ))}
        </AttachmentList>
      )}
      
      {message.status && (
        <MessageStatus 
          status={message.status}
          aria-live="polite"
        >
          {message.status.toLowerCase()}
        </MessageStatus>
      )}
    </MessageItem>
  ), []);

  return (
    <MessageListContainer
      ref={containerRef}
      className={className}
      role="log"
      aria-live="polite"
      aria-label="message list"
      tabIndex={0}
    >
      {loading && (
        <div role="status" aria-label="loading messages">
          <Loader size="medium" />
        </div>
      )}
      
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={messages[virtualRow.index].id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderMessage(messages[virtualRow.index])}
          </div>
        ))}
      </div>
    </MessageListContainer>
  );
};

export default MessageList;