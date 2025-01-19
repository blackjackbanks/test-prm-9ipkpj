import React, { useCallback, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import Button from '../common/Button';
import type { Attachment } from '../../types/chat';

// Props interface
interface AttachmentUploadProps {
  onUpload: (attachments: Attachment[]) => void;
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
  isLoading?: boolean;
  ariaLabel?: string;
}

// Styled components
const UploadContainer = styled.div<{ isDragOver: boolean; hasError: boolean; isFocused: boolean }>`
  border: 2px dashed ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: ${({ theme }) => theme.spacing.scale.md};
  text-align: center;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  outline: none;
  position: relative;
  background-color: ${({ theme }) => theme.colors.surface};
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.scale.sm};

  ${({ isDragOver, theme }) =>
    isDragOver &&
    css`
      border-color: ${theme.colors.primary};
      background-color: ${theme.colors.focus};
    `}

  ${({ hasError, theme }) =>
    hasError &&
    css`
      border-color: ${theme.colors.error};
      background-color: rgba(255, 59, 48, 0.1);
    `}

  ${({ isFocused, theme }) =>
    isFocused &&
    css`
      box-shadow: 0 0 0 2px ${theme.colors.focus};
    `}

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const UploadText = styled.p`
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  margin: 0;
`;

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  margin: ${({ theme }) => theme.spacing.scale.xs} 0 0;
`;

const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  onUpload,
  maxSize = 10 * 1024 * 1024, // 10MB default
  allowedTypes = ['*/*'],
  maxFiles = 5,
  isLoading = false,
  ariaLabel = 'File upload area'
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];

    if (files.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      return { valid, errors };
    }

    files.forEach(file => {
      if (file.size > maxSize) {
        errors.push(`${file.name} exceeds maximum size of ${maxSize / 1024 / 1024}MB`);
      } else if (allowedTypes[0] !== '*/*' && !allowedTypes.includes(file.type)) {
        errors.push(`${file.name} has unsupported file type`);
      } else {
        valid.push(file);
      }
    });

    return { valid, errors };
  };

  const processFiles = async (files: File[]) => {
    const { valid, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    const attachments: Attachment[] = valid.map(file => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      mimeType: file.type
    }));

    setError(null);
    onUpload(attachments);
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);

      const files = Array.from(event.dataTransfer.files);
      processFiles(files);
    },
    [onUpload, maxSize, allowedTypes, maxFiles]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    event.target.value = ''; // Reset input
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <UploadContainer
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      isDragOver={isDragOver}
      hasError={!!error}
      isFocused={isFocused}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-describedby={error ? 'upload-error' : undefined}
    >
      <HiddenInput
        ref={fileInputRef}
        type="file"
        multiple
        accept={allowedTypes.join(',')}
        onChange={handleFileChange}
        aria-hidden="true"
      />
      <Button
        variant="secondary"
        size="small"
        loading={isLoading}
        disabled={isLoading}
        icon={<span aria-hidden="true">📎</span>}
      >
        Choose Files
      </Button>
      <UploadText>or drag and drop files here</UploadText>
      {error && (
        <ErrorText id="upload-error" role="alert">
          {error}
        </ErrorText>
      )}
    </UploadContainer>
  );
};

export default AttachmentUpload;