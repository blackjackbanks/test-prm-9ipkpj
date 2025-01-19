import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components'; // v6.0.0
import debounce from 'lodash/debounce'; // v4.17.21
import { validateInput } from '../../utils/validation';
import { useTheme } from '../../hooks/useTheme';
import { lightTheme } from '../../styles/theme';

// Type definitions
type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'search';
type InputSize = 'small' | 'medium' | 'large';

interface InputProps {
  name: string;
  type?: InputType;
  value: string;
  placeholder?: string;
  size?: InputSize;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  pattern?: string;
  validate?: (value: string) => string | undefined;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>, isValid: boolean) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>, isValid: boolean) => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

// Styled components
const InputWrapper = styled.div`
  position: relative;
  width: 100%;
  font-family: ${lightTheme.typography.fontFamily.primary};
`;

const StyledInput = styled.input<{ size?: InputSize; hasError?: boolean }>`
  width: 100%;
  font-family: inherit;
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid ${props => props.hasError ? 'var(--color-error)' : 'var(--color-border)'};
  border-radius: 6px;
  outline: none;
  transition: all 0.2s ease-in-out;
  
  ${props => {
    switch (props.size) {
      case 'small':
        return `
          height: 32px;
          padding: 0 8px;
          font-size: ${lightTheme.typography.fontSize.small};
        `;
      case 'large':
        return `
          height: 48px;
          padding: 0 16px;
          font-size: ${lightTheme.typography.fontSize.h3};
        `;
      default:
        return `
          height: 40px;
          padding: 0 12px;
          font-size: ${lightTheme.typography.fontSize.body};
        `;
    }
  }}

  &:hover {
    border-color: var(--color-primary);
  }

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-focus);
  }

  &:disabled {
    background: var(--color-surface-alt);
    color: var(--color-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  &::placeholder {
    color: var(--color-text-secondary);
    opacity: 0.8;
  }
`;

const ErrorMessage = styled.span`
  display: block;
  margin-top: 4px;
  color: var(--color-error);
  font-size: ${lightTheme.typography.fontSize.small};
  font-weight: ${lightTheme.typography.fontWeight.medium};
`;

// Input component
export const Input = React.memo(({
  name,
  type = 'text',
  value,
  placeholder,
  size = 'medium',
  error,
  disabled = false,
  required = false,
  pattern,
  validate,
  onChange,
  onBlur,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputProps) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [internalError, setInternalError] = useState<string | undefined>(error);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = `${name}-error`;

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce((value: string) => {
      if (validate) {
        const validationError = validate(value);
        setInternalError(validationError);
        return !validationError;
      }
      if (pattern) {
        const regex = new RegExp(pattern);
        const isValid = regex.test(value);
        setInternalError(isValid ? undefined : 'Invalid format');
        return isValid;
      }
      return true;
    }, 300),
    [validate, pattern]
  );

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const isValid = debouncedValidate(e.target.value);
    onChange?.(e, isValid);
  }, [onChange, debouncedValidate]);

  // Handle input blur
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const isValid = debouncedValidate(e.target.value);
    onBlur?.(e, isValid);
  }, [onBlur, debouncedValidate]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  }, []);

  // Update internal error when prop changes
  useEffect(() => {
    setInternalError(error);
  }, [error]);

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  return (
    <InputWrapper>
      <StyledInput
        ref={inputRef}
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        size={size}
        disabled={disabled}
        required={required}
        pattern={pattern}
        hasError={!!internalError}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        aria-invalid={!!internalError}
        aria-required={required}
        aria-label={ariaLabel}
        aria-describedby={internalError ? errorId : ariaDescribedBy}
        data-theme={theme.toLowerCase()}
        {...props}
      />
      {internalError && (
        <ErrorMessage id={errorId} role="alert">
          {internalError}
        </ErrorMessage>
      )}
    </InputWrapper>
  );
});

Input.displayName = 'Input';

export default Input;