import React from 'react'; // v18.0.0
import styled, { css } from 'styled-components'; // v6.0.0
import { styled as styledComponents, css as cssComponents } from '../../styles/components';
import type { Theme } from '../../styles/theme';

// Badge variants with semantic meanings
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

// Badge sizes following 8px grid
export type BadgeSize = 'small' | 'medium' | 'large';

// Props interface with accessibility support
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  outlined?: boolean;
  'aria-label'?: string;
}

// Helper function to get variant-specific styles with proper contrast
const getVariantStyles = ({ 
  variant = 'default', 
  theme, 
  outlined 
}: { 
  variant: BadgeVariant; 
  theme: Theme; 
  outlined: boolean; 
}) => {
  const variantColors = {
    default: {
      bg: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border
    },
    success: {
      bg: theme.colors.success,
      text: '#FFFFFF',
      border: theme.colors.success
    },
    warning: {
      bg: theme.colors.warning,
      text: '#000000',
      border: theme.colors.warning
    },
    error: {
      bg: theme.colors.error,
      text: '#FFFFFF',
      border: theme.colors.error
    },
    info: {
      bg: theme.colors.info,
      text: '#FFFFFF',
      border: theme.colors.info
    }
  };

  const { bg, text, border } = variantColors[variant];

  return css`
    background-color: ${outlined ? 'transparent' : bg};
    color: ${outlined ? border : text};
    border: 1px solid ${border};
    
    &:hover {
      filter: brightness(95%);
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors.focus};
      outline-offset: 2px;
    }
  `;
};

// Helper function to get size-specific styles following 8px grid
const getSizeStyles = (size: BadgeSize, theme: Theme) => {
  const sizeStyles = {
    small: css`
      padding: ${theme.spacing.scale.xs} ${theme.spacing.scale.sm};
      font-size: ${theme.typography.fontSize.small};
      line-height: ${theme.typography.lineHeight.small};
      min-height: 24px;
    `,
    medium: css`
      padding: ${theme.spacing.scale.sm} ${theme.spacing.scale.md};
      font-size: ${theme.typography.fontSize.body};
      line-height: ${theme.typography.lineHeight.body};
      min-height: 32px;
    `,
    large: css`
      padding: ${theme.spacing.scale.sm} ${theme.spacing.scale.lg};
      font-size: ${theme.typography.fontSize.h3};
      line-height: ${theme.typography.lineHeight.h3};
      min-height: 40px;
    `
  };

  return sizeStyles[size];
};

// Styled span element with accessibility features
const StyledBadge = styled.span<{
  variant: BadgeVariant;
  size: BadgeSize;
  outlined: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  transition: all 0.2s ${props => props.theme.colors.smooth};
  will-change: transform;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
  cursor: default;

  ${props => getVariantStyles({
    variant: props.variant,
    theme: props.theme,
    outlined: props.outlined
  })}

  ${props => getSizeStyles(props.size, props.theme)}
`;

// Badge component with accessibility support
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'medium',
  outlined = false,
  'aria-label': ariaLabel,
  ...props
}) => {
  return (
    <StyledBadge
      variant={variant}
      size={size}
      outlined={outlined}
      role="status"
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </StyledBadge>
  );
};

export default Badge;