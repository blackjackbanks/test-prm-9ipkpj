import React, { useCallback, useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import FocusTrap from 'focus-trap-react';
import { fadeIn, slideIn, ANIMATION_DURATION, ANIMATION_EASING } from '../../styles/animations';
import type { Theme } from '../../styles/theme';

// Modal size variants with responsive breakpoints
export type ModalSize = 'small' | 'medium' | 'large';

// Size configuration for different modal variants
const MODAL_SIZES = {
  small: '400px',
  medium: '600px',
  large: '800px'
} as const;

// Z-index configuration for modal layers
const Z_INDEX = {
  MODAL: 1000,
  BACKDROP: 999
} as const;

// Props interface with comprehensive accessibility options
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  title?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  testId?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  disableAnimation?: boolean;
}

// Styled backdrop with fade animation
const Backdrop = styled.div<{ $disableAnimation?: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => 'rgba(0, 0, 0, 0.4)'};
  z-index: ${Z_INDEX.BACKDROP};
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} ${ANIMATION_DURATION.normal} ${ANIMATION_EASING.smooth};
  ${({ $disableAnimation }) => $disableAnimation && 'animation: none;'}
`;

// Styled modal container with size variants and animations
const ModalContainer = styled.div<{ $size: ModalSize; $disableAnimation?: boolean }>`
  position: relative;
  background: ${({ theme }) => theme.colors.background};
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.modal};
  max-width: ${({ $size }) => MODAL_SIZES[$size]};
  width: calc(100% - ${({ theme }) => theme.spacing.scale.xl});
  max-height: calc(100vh - ${({ theme }) => theme.spacing.scale.xxl});
  margin: ${({ theme }) => theme.spacing.scale.lg};
  display: flex;
  flex-direction: column;
  z-index: ${Z_INDEX.MODAL};
  animation: ${slideIn} ${ANIMATION_DURATION.normal} ${ANIMATION_EASING.smooth};
  ${({ $disableAnimation }) => $disableAnimation && 'animation: none;'}
  
  @media (max-width: ${({ theme }) => theme.breakpoints?.mobile}) {
    width: calc(100% - ${({ theme }) => theme.spacing.scale.lg});
    margin: ${({ theme }) => theme.spacing.scale.md};
  }
`;

// Styled header with MacOS-inspired design
const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.scale.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: ${({ theme }) => theme.spacing.scale.xs};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color 0.2s ease;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }
`;

const Content = styled.div`
  padding: ${({ theme }) => theme.spacing.scale.md};
  overflow-y: auto;
  flex: 1;
`;

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  size = 'medium',
  title,
  closeOnBackdrop = true,
  closeOnEscape = true,
  testId = 'modal',
  ariaLabel,
  ariaDescribedBy,
  disableAnimation = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && closeOnEscape) {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget && closeOnBackdrop) {
      event.preventDefault();
      onClose();
    }
  }, [closeOnBackdrop, onClose]);

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen, handleEscapeKey]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Backdrop
      onClick={handleBackdropClick}
      data-testid={`${testId}-backdrop`}
      $disableAnimation={disableAnimation}
    >
      <FocusTrap>
        <ModalContainer
          ref={modalRef}
          $size={size}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
          aria-describedby={ariaDescribedBy}
          data-testid={testId}
          $disableAnimation={disableAnimation}
        >
          {title && (
            <Header>
              <Title>{title}</Title>
              <CloseButton
                onClick={onClose}
                aria-label="Close modal"
                data-testid={`${testId}-close`}
              >
                ✕
              </CloseButton>
            </Header>
          )}
          <Content>{children}</Content>
        </ModalContainer>
      </FocusTrap>
    </Backdrop>
  );
};

export default Modal;