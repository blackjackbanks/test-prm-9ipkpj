import React, { forwardRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { lightTheme } from '../../styles/theme';

// Types
type ButtonVariant = 'primary' | 'secondary' | 'text';
type ButtonSize = 'small' | 'medium' | 'large';
type IconPosition = 'left' | 'right';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  tabIndex?: number;
  form?: string;
  name?: string;
}

// Styled components
const getVariantStyles = (
  variant: ButtonVariant = 'primary',
  theme = lightTheme,
  isHovered: boolean,
  isActive: boolean,
  isDisabled: boolean
) => {
  const variants = {
    primary: css`
      background-color: ${theme.colors.primary};
      color: #FFFFFF;
      border: none;
      
      ${isHovered && !isDisabled && css`
        background-color: ${theme.colors.secondary};
        transform: translateY(-1px);
      `}
      
      ${isActive && !isDisabled && css`
        transform: translateY(1px);
        opacity: 0.9;
      `}
    `,
    secondary: css`
      background-color: transparent;
      color: ${theme.colors.primary};
      border: 1px solid ${theme.colors.primary};
      
      ${isHovered && !isDisabled && css`
        background-color: ${theme.colors.focus};
        transform: translateY(-1px);
      `}
      
      ${isActive && !isDisabled && css`
        transform: translateY(1px);
        opacity: 0.9;
      `}
    `,
    text: css`
      background-color: transparent;
      color: ${theme.colors.primary};
      padding: ${theme.spacing.scale.xs} ${theme.spacing.scale.sm};
      
      ${isHovered && !isDisabled && css`
        background-color: ${theme.colors.focus};
        transform: translateY(-1px);
      `}
      
      ${isActive && !isDisabled && css`
        transform: translateY(1px);
        opacity: 0.9;
      `}
    `
  };

  return variants[variant];
};

const getSizeStyles = (size: ButtonSize = 'medium', theme = lightTheme) => {
  const sizes = {
    small: css`
      padding: 6px 12px;
      font-size: ${theme.typography.fontSize.small};
      min-height: 28px;
    `,
    medium: css`
      padding: 8px 16px;
      font-size: ${theme.typography.fontSize.body};
      min-height: 36px;
    `,
    large: css`
      padding: 12px 24px;
      font-size: ${theme.typography.fontSize.h3};
      min-height: 44px;
    `
  };

  return sizes[size];
};

const StyledButton = styled.button<ButtonProps>`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.scale.xs};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  outline: none;
  position: relative;
  white-space: nowrap;
  text-decoration: none;
  user-select: none;
  touch-action: manipulation;
  
  ${({ variant, theme, disabled }) => getVariantStyles(variant, theme, false, false, !!disabled)}
  ${({ size, theme }) => getSizeStyles(size, theme)}
  
  width: ${({ fullWidth }) => fullWidth ? '100%' : 'auto'};
  
  &:focus-visible {
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.focus};
    outline: 2px solid transparent;
  }
  
  ${({ disabled }) => disabled && css`
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  `}
  
  ${({ loading }) => loading && css`
    cursor: wait;
    opacity: 0.8;
    pointer-events: none;
  `}
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
  margin-right: ${({ theme }) => theme.spacing.scale.xs};
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

// Button component
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  onClick,
  children,
  className,
  type = 'button',
  ariaLabel,
  tabIndex,
  form,
  name,
  ...props
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsActive(false);
  };
  const handleMouseDown = () => setIsActive(true);
  const handleMouseUp = () => setIsActive(false);

  return (
    <StyledButton
      ref={ref}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      loading={loading}
      fullWidth={fullWidth}
      onClick={onClick}
      className={className}
      type={type}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      tabIndex={tabIndex}
      form={form}
      name={name}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      {...props}
    >
      {loading && <LoadingSpinner />}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </StyledButton>
  );
});

Button.displayName = 'Button';

export default Button;