import React, { useCallback } from 'react';
import styled, { css } from 'styled-components';
import type { Theme } from '../../styles/theme';

// Props interface for Radio component
interface RadioProps {
  id: string;
  name: string;
  value: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  required?: boolean;
}

// Styled container component for radio and label
const RadioContainer = styled.div<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.base};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  min-height: 44px;
  padding: ${props => props.theme.spacing.scale.xs};
  position: relative;
  opacity: ${props => props.disabled ? 0.5 : 1};
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Styled radio input component with MacOS appearance
const RadioInput = styled.input<{ checked: boolean }>`
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid ${props => props.checked ? props.theme.colors.primary : props.theme.colors.border};
  background-color: ${props => props.checked ? props.theme.colors.primary : props.theme.colors.background};
  transition: all 0.2s ease;
  cursor: inherit;
  position: relative;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    border-color: ${props => props.theme.colors.primary};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.focus};
  }

  ${props => props.checked && css`
    &::after {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${props.theme.colors.background};
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Styled label component
const RadioLabel = styled.label`
  font-family: ${props => props.theme.typography.fontFamily.primary};
  font-size: ${props => props.theme.typography.fontSize.body};
  line-height: ${props => props.theme.typography.lineHeight.body};
  color: ${props => props.theme.colors.text};
  cursor: inherit;
  margin-left: ${props => props.theme.spacing.scale.xs};
`;

// Radio component implementation
const Radio: React.FC<RadioProps> = ({
  id,
  name,
  value,
  label,
  checked,
  disabled = false,
  onChange,
  className,
  ariaLabel,
  required = false,
}) => {
  // Handle keyboard interactions for accessibility
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if ((event.key === ' ' || event.key === 'Enter') && !disabled) {
      event.preventDefault();
      onChange(value);
    }
  }, [disabled, onChange, value]);

  return (
    <RadioContainer
      className={className}
      disabled={disabled}
      onClick={() => !disabled && onChange(value)}
      onKeyPress={handleKeyPress}
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      <RadioInput
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => !disabled && onChange(value)}
        aria-label={ariaLabel || label}
        required={required}
        tabIndex={-1} // Main focus will be on container
      />
      <RadioLabel htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </RadioLabel>
    </RadioContainer>
  );
};

export default Radio;