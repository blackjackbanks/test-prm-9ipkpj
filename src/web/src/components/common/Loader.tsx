import React from 'react';
import styled from 'styled-components';
import { spin } from '../../styles/animations';

// Size mapping for the loader component
const LOADER_SIZES = {
  small: '16px',
  medium: '24px',
  large: '32px'
} as const;

type LoaderSize = keyof typeof LOADER_SIZES;

interface LoaderProps {
  /**
   * Size of the loader - small (16px), medium (24px), or large (32px)
   * @default 'medium'
   */
  size?: LoaderSize;
  /**
   * Color of the spinner - defaults to theme primary color
   */
  color?: string;
  /**
   * Thickness of the spinner border in pixels
   * @default 2
   */
  thickness?: number;
  /**
   * Optional CSS class name for custom styling
   */
  className?: string;
  /**
   * Accessible label for screen readers
   * @default 'Loading'
   */
  ariaLabel?: string;
}

// Helper function to get validated loader size
const getLoaderSize = (size?: LoaderSize): string => {
  if (!size) return LOADER_SIZES.medium;
  
  const validSize = LOADER_SIZES[size];
  if (!validSize && process.env.NODE_ENV === 'development') {
    console.warn(`Invalid loader size: ${size}. Using default size 'medium'.`);
  }
  
  return validSize || LOADER_SIZES.medium;
};

const SpinnerContainer = styled.div<Pick<LoaderProps, 'size' | 'className'>>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: ${props => getLoaderSize(props.size)};
  height: ${props => getLoaderSize(props.size)};
  
  /* Performance optimizations */
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  
  /* Accessibility - Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    animation-duration: 0s;
  }
`;

const SpinnerCircle = styled.div<Pick<LoaderProps, 'size' | 'color' | 'thickness'>>`
  position: absolute;
  width: 100%;
  height: 100%;
  border-style: solid;
  border-radius: 50%;
  border-width: ${props => props.thickness || 2}px;
  border-color: transparent;
  border-top-color: ${props => props.color || props.theme.colors?.primary || '#007AFF'};
  
  /* Animation properties */
  animation: ${spin} 1s linear infinite;
  transform-origin: center center;
  
  /* Performance optimizations */
  will-change: transform;
  backface-visibility: hidden;
  
  /* Accessibility - Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: rotate(180deg);
  }
`;

/**
 * A reusable loading spinner component that provides visual feedback during 
 * asynchronous operations. Follows MacOS-inspired design patterns with 
 * enhanced accessibility and performance optimizations.
 */
const Loader: React.FC<LoaderProps> = ({
  size = 'medium',
  color,
  thickness = 2,
  className,
  ariaLabel = 'Loading'
}) => {
  return (
    <SpinnerContainer
      size={size}
      className={className}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <SpinnerCircle
        size={size}
        color={color}
        thickness={thickness}
      />
    </SpinnerContainer>
  );
};

export default Loader;