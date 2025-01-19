import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import Input from '../../../../src/components/common/Input';
import { renderWithProviders } from '../../../../src/utils/testing';
import { validateInput } from '../../../../src/utils/validation';
import { useTheme } from '../../../../src/hooks/useTheme';

// Mock dependencies
jest.mock('../../../../src/utils/validation');
jest.mock('../../../../src/hooks/useTheme');

// Mock theme hook implementation
const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

describe('Input Component', () => {
  // Common test setup
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() });
  });

  // Default props for testing
  const defaultProps = {
    name: 'test-input',
    value: '',
    onChange: jest.fn(),
    onBlur: jest.fn(),
    'aria-label': 'Test Input'
  };

  describe('Rendering', () => {
    it('renders with default props', () => {
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} />
      );
      
      const input = getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('name', 'test-input');
      expect(input).toHaveAttribute('aria-label', 'Test Input');
    });

    it('applies correct size variants', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { getByRole, rerender } = renderWithProviders(
          <Input {...defaultProps} size={size} />
        );
        
        const input = getByRole('textbox');
        expect(input).toHaveStyle({
          height: size === 'small' ? '32px' : size === 'large' ? '48px' : '40px'
        });
        
        rerender(<Input {...defaultProps} />);
      });
    });

    it('handles disabled state correctly', () => {
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} disabled />
      );
      
      const input = getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveStyle({
        backgroundColor: 'var(--color-surface-alt)',
        cursor: 'not-allowed'
      });
    });

    it('applies theme-specific styles', () => {
      mockUseTheme.mockReturnValueOnce({ theme: 'dark', setTheme: jest.fn() });
      
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} />
      );
      
      const input = getByRole('textbox');
      expect(input).toHaveAttribute('data-theme', 'dark');
    });
  });

  describe('User Interaction', () => {
    it('handles text input correctly', async () => {
      const onChange = jest.fn();
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} onChange={onChange} />
      );
      
      const input = getByRole('textbox');
      await userEvent.type(input, 'test value');
      
      expect(onChange).toHaveBeenCalledTimes(10); // One call per character
      expect(input).toHaveValue('test value');
    });

    it('maintains cursor position during input', async () => {
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} value="initial value" />
      );
      
      const input = getByRole('textbox') as HTMLInputElement;
      input.setSelectionRange(3, 3);
      await userEvent.type(input, 'test');
      
      expect(input.selectionStart).toBe(7);
      expect(input.selectionEnd).toBe(7);
    });

    it('handles focus/blur events', async () => {
      const onBlur = jest.fn();
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} onBlur={onBlur} />
      );
      
      const input = getByRole('textbox');
      await userEvent.click(input);
      expect(input).toHaveFocus();
      
      await userEvent.tab();
      expect(onBlur).toHaveBeenCalled();
      expect(input).not.toHaveFocus();
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      (validateInput as jest.Mock).mockReset();
    });

    it('validates on blur', async () => {
      const mockValidate = jest.fn(() => 'Error message');
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} validate={mockValidate} />
      );
      
      const input = getByRole('textbox');
      await userEvent.click(input);
      await userEvent.tab();
      
      expect(mockValidate).toHaveBeenCalled();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('displays error messages with correct styling', async () => {
      const { getByRole, getByText } = renderWithProviders(
        <Input {...defaultProps} error="Test error message" />
      );
      
      const errorMessage = getByText('Test error message');
      expect(errorMessage).toHaveStyle({
        color: 'var(--color-error)'
      });
      
      const input = getByRole('textbox');
      expect(input).toHaveStyle({
        borderColor: 'var(--color-error)'
      });
    });

    it('handles async validation', async () => {
      const asyncValidate = jest.fn().mockResolvedValue('Async error');
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} validate={asyncValidate} />
      );
      
      const input = getByRole('textbox');
      await userEvent.type(input, 'test');
      await userEvent.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Async error')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('provides correct ARIA attributes', () => {
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} error="Error message" />
      );
      
      const input = getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', `${defaultProps.name}-error`);
    });

    it('supports screen readers', () => {
      const { getByRole } = renderWithProviders(
        <Input 
          {...defaultProps}
          error="Error message"
          required
          aria-describedby="helper-text"
        />
      );
      
      const input = getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('helper-text'));
    });

    it('announces error messages to screen readers', async () => {
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} error="Validation error" />
      );
      
      const errorMessage = screen.getByText('Validation error');
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('handles keyboard navigation', async () => {
      const onKeyDown = jest.fn();
      const { getByRole } = renderWithProviders(
        <Input {...defaultProps} onKeyDown={onKeyDown} />
      );
      
      const input = getByRole('textbox');
      await userEvent.type(input, '{esc}');
      expect(input).not.toHaveFocus();
      
      await userEvent.type(input, '{enter}');
      expect(onKeyDown).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});