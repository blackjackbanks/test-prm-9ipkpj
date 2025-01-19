import React from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { css } from '../../styles/components';
import type { Theme } from '../../styles/theme';
import { fadeAnimation } from '../../styles/animations';

// Props interface with comprehensive type safety
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

// Styled components with MacOS-inspired design
const ToggleContainer = styled.div<{ disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.scale.sm};
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  position: relative;
  outline: none;

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
    border-radius: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
    }
  }
`;

const ToggleSwitch = styled.div<{ checked: boolean; disabled?: boolean }>`
  position: relative;
  width: 40px;
  height: 24px;
  background: ${({ theme, checked }) => 
    checked ? theme.colors.primary : theme.colors.textSecondary};
  border-radius: 12px;
  transition: background-color 0.2s ease;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
  will-change: background-color;
  -webkit-tap-highlight-color: transparent;
  opacity: ${({ disabled }) => disabled ? 0.6 : 1};
`;

const ToggleKnob = styled.div<{ checked: boolean }>`
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: 50%;
  transform: translateX(${({ checked }) => checked ? '18px' : '0'});
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  will-change: transform;
`;

const ToggleLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  color: ${({ theme }) => theme.colors.text};
  user-select: none;
  cursor: inherit;
`;

// Hidden input for native form functionality and accessibility
const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
`;

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  name,
  className,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
  onFocus,
  onBlur
}) => {
  // Generate unique ID if not provided
  const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

  // Handle keyboard interactions for accessibility
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <ToggleContainer
      className={className}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyPress={handleKeyPress}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      data-testid={dataTestId}
    >
      <HiddenInput
        type="checkbox"
        id={toggleId}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label={ariaLabel || label}
      />
      <ToggleSwitch checked={checked} disabled={disabled}>
        <ToggleKnob checked={checked} />
      </ToggleSwitch>
      {label && <ToggleLabel htmlFor={toggleId}>{label}</ToggleLabel>}
    </ToggleContainer>
  );
};

export default Toggle;