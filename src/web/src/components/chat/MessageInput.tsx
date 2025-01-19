import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { debounce } from 'lodash';
import Button from '../common/Button';
import AttachmentUpload from './AttachmentUpload';
import type { Message, Attachment } from '../../types/chat';

// Props interface
interface MessageInputProps {
  onSend: (message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => Promise<void>;
  disabled?: boolean;
  maxAttachments?: number;
  placeholder?: string;
}

// Styled components with MacOS-inspired design
const InputContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.sm};
  padding: ${({ theme }) => theme.spacing.scale.md};
  background: ${({ theme }) => theme.colors.background};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  transition: all 0.2s ease-in-out;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.scale.sm};
`;

const TextArea = styled.textarea`
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: ${({ theme }) => theme.spacing.scale.sm};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  line-height: ${({ theme }) => theme.typography.lineHeight.body};
  color: ${({ theme }) => theme.colors.text};
  resize: none;
  outline: none;
  transition: border-color 0.2s ease-in-out;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.focus};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.disabled};
    cursor: not-allowed;
  }
`;

const AttachmentContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.scale.sm};
  flex-wrap: wrap;
`;

const AttachmentPreview = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.scale.xs};
  padding: ${({ theme }) => theme.spacing.scale.xs} ${({ theme }) => theme.spacing.scale.sm};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.small};
`;

const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  disabled = false,
  maxAttachments = 5,
  placeholder = 'Type a message...'
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustTextAreaHeight = useCallback(() => {
    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.style.height = 'auto';
      textArea.style.height = `${Math.min(textArea.scrollHeight, 120)}px`;
    }
  }, []);

  // Debounced text change handler
  const handleTextChange = debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    adjustTextAreaHeight();
  }, 100);

  // Handle file attachments
  const handleAttachmentUpload = (newAttachments: Attachment[]) => {
    setAttachments(prev => {
      const combined = [...prev, ...newAttachments];
      return combined.slice(0, maxAttachments);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(attachment => attachment.id !== id));
  };

  // Handle message submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!text.trim() && attachments.length === 0) return;
    if (disabled || isLoading) return;

    try {
      setIsLoading(true);

      const message = {
        type: 'USER',
        content: text.trim(),
        attachments,
        status: 'SENDING'
      };

      await onSend(message);

      // Clear input on success
      setText('');
      setAttachments([]);
      if (textAreaRef.current) {
        textAreaRef.current.style.height = '40px';
      }

      // Announce success to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = 'Message sent successfully';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <InputContainer onSubmit={handleSubmit} aria-label="Message input form">
      {attachments.length > 0 && (
        <AttachmentContainer>
          {attachments.map(attachment => (
            <AttachmentPreview key={attachment.id}>
              <span>{attachment.name}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => removeAttachment(attachment.id)}
                ariaLabel={`Remove ${attachment.name}`}
              >
                ✕
              </Button>
            </AttachmentPreview>
          ))}
        </AttachmentContainer>
      )}
      <InputWrapper>
        <TextArea
          ref={textAreaRef}
          value={text}
          onChange={handleTextChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Message input"
          aria-multiline="true"
          role="textbox"
        />
        <AttachmentUpload
          onUpload={handleAttachmentUpload}
          maxFiles={maxAttachments - attachments.length}
          isLoading={isLoading}
          ariaLabel="Add attachments"
        />
        <Button
          type="submit"
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          loading={isLoading}
          ariaLabel="Send message"
        >
          Send
        </Button>
      </InputWrapper>
    </InputContainer>
  );
};

export default MessageInput;