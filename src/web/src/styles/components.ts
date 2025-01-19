import styled, { css } from 'styled-components'; // v6.0.0
import { lightTheme } from './theme';
import { media, Breakpoint } from './breakpoints';
import { fadeIn, AnimationProps } from './animations';

// Type definitions for component variants
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';
export type InputSize = 'small' | 'medium' | 'large';

// Base styles shared across components
const baseStyles = css`
  font-family: ${lightTheme.typography.fontFamily.primary};
  font-size: ${lightTheme.typography.fontSize.body};
  line-height: 1.5;
  transition: all 0.2s ease-in-out;
`;

// Helper function to create variant styles with runtime validation
const createVariant = (variant: ButtonVariant | InputSize, theme = lightTheme, animation?: AnimationProps) => {
  // Button variants
  const buttonVariants = {
    primary: css`
      background: ${theme.colors.primary};
      color: #FFFFFF;
      border: none;
      &:hover {
        background: ${theme.colors.secondary};
      }
    `,
    secondary: css`
      background: transparent;
      color: ${theme.colors.primary};
      border: 1px solid ${theme.colors.primary};
      &:hover {
        background: ${theme.colors.focus};
      }
    `,
    text: css`
      background: transparent;
      color: ${theme.colors.text};
      border: none;
      &:hover {
        color: ${theme.colors.primary};
      }
    `,
    danger: css`
      background: ${theme.colors.error};
      color: #FFFFFF;
      border: none;
      &:hover {
        opacity: 0.9;
      }
    `
  };

  // Input sizes
  const inputSizes = {
    small: css`
      height: 32px;
      padding: ${theme.spacing.scale.xs} ${theme.spacing.scale.sm};
      font-size: ${theme.typography.fontSize.small};
    `,
    medium: css`
      height: 40px;
      padding: ${theme.spacing.scale.sm} ${theme.spacing.scale.md};
      font-size: ${theme.typography.fontSize.body};
    `,
    large: css`
      height: 48px;
      padding: ${theme.spacing.scale.sm} ${theme.spacing.scale.lg};
      font-size: ${theme.typography.fontSize.h3};
    `
  };

  const variants = { ...buttonVariants, ...inputSizes };
  const selectedVariant = variants[variant];

  if (!selectedVariant) {
    throw new Error(`Invalid variant: ${variant}`);
  }

  return css`
    ${selectedVariant}
    ${animation && css`
      animation: ${animation.keyframes} ${animation.duration} ${animation.easing};
    `}
  `;
};

// Container component with responsive padding
export const Container = styled.div<{ padding?: string }>`
  ${baseStyles}
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: ${props => props.padding || lightTheme.spacing.scale.md};
  animation: ${fadeIn} 0.3s ease-in-out;

  ${media.tablet`
    padding: ${lightTheme.spacing.scale.lg};
  `}

  ${media.desktop`
    padding: ${lightTheme.spacing.scale.xl};
  `}
`;

// Card component with elevation and hover effects
export const Card = styled.div<{ elevation?: 1 | 2 | 3 }>`
  ${baseStyles}
  background: ${lightTheme.colors.surface};
  border-radius: 8px;
  padding: ${lightTheme.spacing.scale.md};
  box-shadow: ${props => 
    props.elevation === 2 ? lightTheme.shadows.modal :
    props.elevation === 3 ? lightTheme.shadows.popup :
    lightTheme.shadows.surface
  };
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${lightTheme.shadows.modal};
  }

  ${media.mobile`
    padding: ${lightTheme.spacing.scale.sm};
  `}
`;

// Button component with variants and accessibility features
export const Button = styled.button<{ variant?: ButtonVariant }>`
  ${baseStyles}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${lightTheme.spacing.scale.sm} ${lightTheme.spacing.scale.md};
  border-radius: 6px;
  cursor: pointer;
  font-weight: ${lightTheme.typography.fontWeight.medium};
  outline: none;
  position: relative;
  user-select: none;
  white-space: nowrap;

  ${props => createVariant(props.variant || 'primary')}

  &:focus-visible {
    box-shadow: 0 0 0 2px ${lightTheme.colors.focus};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:active {
    transform: scale(0.98);
  }
`;

// Input component with validation states and sizes
export const Input = styled.input<{ size?: InputSize; error?: boolean; success?: boolean }>`
  ${baseStyles}
  width: 100%;
  border: 1px solid ${props => 
    props.error ? lightTheme.colors.error :
    props.success ? lightTheme.colors.success :
    lightTheme.colors.border
  };
  border-radius: 6px;
  background: ${lightTheme.colors.background};
  color: ${lightTheme.colors.text};
  outline: none;

  ${props => createVariant(props.size || 'medium')}

  &:focus {
    border-color: ${lightTheme.colors.primary};
    box-shadow: 0 0 0 2px ${lightTheme.colors.focus};
  }

  &:disabled {
    background: ${lightTheme.colors.surfaceAlt};
    cursor: not-allowed;
  }

  &::placeholder {
    color: ${lightTheme.colors.textSecondary};
  }

  ${props => props.error && css`
    &:focus {
      border-color: ${lightTheme.colors.error};
      box-shadow: 0 0 0 2px ${lightTheme.colors.error}20;
    }
  `}

  ${props => props.success && css`
    &:focus {
      border-color: ${lightTheme.colors.success};
      box-shadow: 0 0 0 2px ${lightTheme.colors.success}20;
    }
  `}
`;