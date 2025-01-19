import React from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { css } from '../../styles/components';
import type { Theme } from '../../styles/theme';

// Props interface with comprehensive type safety
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  name?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  testId?: string;
}

// Styled components with MacOS-inspired design
const CheckboxContainer = styled.label<{ disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  opacity: ${props => props.disabled ? 0.5 : 1};
  transition: opacity 0.2s ${props => props.theme.typography.fontFamily.primary};
  gap: ${props => props.theme.spacing.scale.sm};
  
  &:hover {
    ${props => !props.disabled && css`
      ${CheckboxIndicator} {
        transform: scale(1.05);
      }
    `}
  }
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;

  &:focus-visible + ${CheckboxIndicator} {
    box-shadow: 0 0 0 2px ${props => props.theme.colors.focus};
  }
`;

const CheckboxIndicator = styled.div<{ checked: boolean; theme: Theme }>`
  width: 16px;
  height: 16px;
  border: 2px solid ${props => props.checked ? props.theme.colors.primary : props.theme.colors.border};
  border-radius: 4px;
  background: ${props => props.checked ? props.theme.colors.primary : 'transparent'};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, box-shadow;

  &:after {
    content: '';
    display: ${props => props.checked ? 'block' : 'none'};
    width: 6px;
    height: 6px;
    border: solid ${props => props.theme.colors.background};
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-top: -2px;
  }
`;

const Label = styled.span`
  font-family: ${props => props.theme.typography.fontFamily.primary};
  font-size: ${props => props.theme.typography.fontSize.body};
  color: ${props => props.theme.colors.text};
  line-height: 1.2;
  transition: color 0.2s ease;
`;

// Memoized checkbox component for performance
const Checkbox = React.memo<CheckboxProps>(({
  checked,
  onChange,
  disabled = false,
  label,
  name,
  className,
  id,
  ariaLabel,
  testId
}) => {
  // Handle keyboard interactions
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(!checked);
    }
  };

  // Handle change events
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(event.target.checked);
    }
  };

  return (
    <CheckboxContainer
      disabled={disabled}
      className={className}
      data-testid={testId}
    >
      <HiddenInput
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        name={name}
        id={id}
        aria-label={ariaLabel || label}
        aria-checked={checked}
        onKeyDown={handleKeyDown}
      />
      <CheckboxIndicator checked={checked} />
      {label && <Label>{label}</Label>}
    </CheckboxContainer>
  );
});

// Display name for debugging
Checkbox.displayName = 'Checkbox';

export default Checkbox;