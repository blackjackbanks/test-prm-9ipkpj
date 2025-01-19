import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { fadeIn } from '../../styles/animations';
import type { Theme } from '../../styles/theme';

// Constants
const DEFAULT_DELAY = 200;
const TOOLTIP_OFFSET = 8;
const MOBILE_BREAKPOINT = 768;
const MIN_TOUCH_TARGET = 44;
const ARIA_HIDE_DELAY = 150;

// Types
export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  content: string | React.ReactNode;
  position?: TooltipPosition;
  children: React.ReactNode;
  delay?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
  persistOnMobile?: boolean;
  showOnFocus?: boolean;
  zIndex?: number;
}

// Styled components
const TooltipContainer = styled.div`
  position: relative;
  display: inline-flex;
  max-width: 100%;
`;

const TooltipTrigger = styled.div`
  display: inline-flex;
  min-height: ${MIN_TOUCH_TARGET}px;
  min-width: ${MIN_TOUCH_TARGET}px;
  align-items: center;
  justify-content: center;
`;

interface TooltipContentProps {
  $position: TooltipPosition;
  $isVisible: boolean;
  $zIndex: number;
  theme: Theme;
}

const TooltipContent = styled.div<TooltipContentProps>`
  position: absolute;
  z-index: ${props => props.$zIndex};
  padding: ${props => props.theme.spacing.scale.sm} ${props => props.theme.spacing.scale.md};
  background-color: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  border-radius: 6px;
  font-size: ${props => props.theme.typography.fontSize.small};
  line-height: ${props => props.theme.typography.lineHeight.small};
  font-family: ${props => props.theme.typography.fontFamily.primary};
  box-shadow: ${props => props.theme.shadows.tooltip};
  max-width: 300px;
  word-wrap: break-word;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  
  ${props => props.$isVisible && css`
    opacity: 1;
    visibility: visible;
    animation: ${fadeIn} 0.2s ease-in-out forwards;
  `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    display: ${props => !props.$isVisible && 'none'};
  }
`;

// Helper function to calculate tooltip position
const getTooltipPosition = (
  triggerRect: DOMRect,
  position: TooltipPosition,
  tooltipRect: DOMRect,
  isRTL: boolean
) => {
  const spacing = TOOLTIP_OFFSET;
  let top = 0;
  let left = 0;

  switch (position) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - spacing;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'bottom':
      top = triggerRect.bottom + spacing;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'left':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = isRTL ? triggerRect.right + spacing : triggerRect.left - tooltipRect.width - spacing;
      break;
    case 'right':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = isRTL ? triggerRect.left - tooltipRect.width - spacing : triggerRect.right + spacing;
      break;
  }

  return { top, left };
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
  delay = DEFAULT_DELAY,
  className,
  disabled = false,
  id,
  persistOnMobile = false,
  showOnFocus = true,
  zIndex = 1000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<number>();
  const uniqueId = useRef(`tooltip-${id || Math.random().toString(36).substr(2, 9)}`);
  const isRTL = document.dir === 'rtl';
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

  const updatePosition = useCallback(() => {
    if (triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const newPosition = getTooltipPosition(triggerRect, position, tooltipRect, isRTL);
      setTooltipPosition(newPosition);
    }
  }, [position, isRTL]);

  const handleShow = useCallback(() => {
    if (disabled || (!persistOnMobile && isMobile)) return;
    
    showTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  }, [disabled, persistOnMobile, isMobile, delay, updatePosition]);

  const handleHide = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  const handleFocus = useCallback(() => {
    if (showOnFocus) {
      handleShow();
    }
  }, [showOnFocus, handleShow]);

  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        updatePosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isVisible, updatePosition]);

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
    };
  }, []);

  return (
    <TooltipContainer className={className}>
      <TooltipTrigger
        ref={triggerRef}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleFocus}
        onBlur={handleHide}
        aria-describedby={isVisible ? uniqueId.current : undefined}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        ref={tooltipRef}
        $position={position}
        $isVisible={isVisible}
        $zIndex={zIndex}
        id={uniqueId.current}
        role="tooltip"
        aria-hidden={!isVisible}
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
        }}
      >
        {content}
      </TooltipContent>
    </TooltipContainer>
  );
};

export default Tooltip;