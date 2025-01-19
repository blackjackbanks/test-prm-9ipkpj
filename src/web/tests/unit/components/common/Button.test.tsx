import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';

import Button from '../../../../src/components/common/Button';
import { renderWithProviders } from '../../../../src/utils/testing';

expect.extend(toHaveNoViolations);

// Test IDs for querying elements
const TEST_IDS = {
  button: 'button-component',
  icon: 'button-icon',
  spinner: 'button-spinner'
};

// Default props for consistent testing
const defaultProps = {
  variant: 'primary' as const,
  size: 'medium' as const,
  disabled: false,
  loading: false,
  fullWidth: false,
  iconPosition: 'left' as const,
  children: 'Test Button',
  onClick: jest.fn(),
  'aria-label': 'Test Button'
};

// Helper function to render Button with providers
const renderButton = (props = {}) => {
  return renderWithProviders(
    <Button 
      data-testid={TEST_IDS.button}
      {...defaultProps}
      {...props}
    />
  );
};

describe('Button Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visual Variants', () => {
    it('renders primary variant with MacOS-inspired styling', () => {
      const { getByTestId } = renderButton();
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        backgroundColor: '#007AFF',
        color: '#FFFFFF'
      });
    });

    it('renders secondary variant with outline styles', () => {
      const { getByTestId } = renderButton({ variant: 'secondary' });
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        backgroundColor: 'transparent',
        border: '1px solid #007AFF'
      });
    });

    it('renders text variant without background', () => {
      const { getByTestId } = renderButton({ variant: 'text' });
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        backgroundColor: 'transparent'
      });
    });

    it('applies correct size styles', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      sizes.forEach(size => {
        const { getByTestId, rerender } = renderButton({ size });
        const button = getByTestId(TEST_IDS.button);
        
        const expectedHeight = {
          small: '28px',
          medium: '36px',
          large: '44px'
        }[size];
        
        expect(button).toHaveStyle({
          minHeight: expectedHeight
        });
        
        rerender(<Button {...defaultProps} size={size} />);
      });
    });

    it('applies full width layout when specified', () => {
      const { getByTestId } = renderButton({ fullWidth: true });
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        width: '100%'
      });
    });
  });

  describe('Interactive States', () => {
    it('shows hover state styles on mouse enter', async () => {
      const { getByTestId } = renderButton();
      const button = getByTestId(TEST_IDS.button);
      
      await userEvent.hover(button);
      
      expect(button).toHaveStyle({
        backgroundColor: '#5856D6',
        transform: 'translateY(-1px)'
      });
    });

    it('shows active state on mouse down', async () => {
      const { getByTestId } = renderButton();
      const button = getByTestId(TEST_IDS.button);
      
      fireEvent.mouseDown(button);
      
      expect(button).toHaveStyle({
        transform: 'translateY(1px)',
        opacity: '0.9'
      });
    });

    it('shows focus ring on keyboard focus', async () => {
      const { getByTestId } = renderButton();
      const button = getByTestId(TEST_IDS.button);
      
      button.focus();
      
      expect(button).toHaveStyle({
        boxShadow: '0 0 0 2px rgba(0,122,255,0.2)'
      });
    });

    it('disables button interactions when loading', () => {
      const { getByTestId } = renderButton({ loading: true });
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        cursor: 'wait',
        opacity: '0.8',
        pointerEvents: 'none'
      });
      expect(button).toBeDisabled();
    });

    it('prevents interactions when disabled', () => {
      const onClick = jest.fn();
      const { getByTestId } = renderButton({ disabled: true, onClick });
      const button = getByTestId(TEST_IDS.button);
      
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
      expect(button).toHaveStyle({
        opacity: '0.5',
        cursor: 'not-allowed',
        pointerEvents: 'none'
      });
    });
  });

  describe('Accessibility Features', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = renderButton();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', () => {
      const onClick = jest.fn();
      const { getByTestId } = renderButton({ onClick });
      const button = getByTestId(TEST_IDS.button);
      
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(onClick).toHaveBeenCalled();
      
      fireEvent.keyDown(button, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('provides appropriate ARIA attributes', () => {
      const { getByTestId } = renderButton({
        disabled: true,
        'aria-label': 'Custom Label'
      });
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });

    it('maintains focus visibility for keyboard users', () => {
      const { getByTestId } = renderButton();
      const button = getByTestId(TEST_IDS.button);
      
      button.focus();
      expect(button).toHaveStyleRule('outline', '2px solid transparent', {
        modifier: ':focus-visible'
      });
    });
  });

  describe('Theme Integration', () => {
    it('applies light theme styles correctly', () => {
      const { getByTestId } = renderButton();
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        backgroundColor: '#007AFF',
        color: '#FFFFFF'
      });
    });

    it('applies dark theme styles correctly', () => {
      const { getByTestId } = renderWithProviders(
        <Button {...defaultProps} data-testid={TEST_IDS.button} />,
        { preloadedState: { ui: { theme: 'dark' } } }
      );
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        backgroundColor: '#0A84FF',
        color: '#FFFFFF'
      });
    });

    it('transitions styles smoothly on theme change', async () => {
      const { getByTestId } = renderButton();
      const button = getByTestId(TEST_IDS.button);
      
      expect(button).toHaveStyle({
        transition: 'all 0.2s ease-in-out'
      });
    });
  });

  describe('Icon Integration', () => {
    const TestIcon = () => <span data-testid={TEST_IDS.icon}>★</span>;

    it('renders icon in correct position', () => {
      const { getByTestId, rerender } = renderButton({
        icon: <TestIcon />,
        iconPosition: 'left'
      });
      
      let button = getByTestId(TEST_IDS.button);
      let icon = getByTestId(TEST_IDS.icon);
      expect(button.firstChild).toBe(icon);
      
      rerender(
        <Button
          {...defaultProps}
          icon={<TestIcon />}
          iconPosition="right"
          data-testid={TEST_IDS.button}
        />
      );
      
      button = getByTestId(TEST_IDS.button);
      icon = getByTestId(TEST_IDS.icon);
      expect(button.lastChild).toBe(icon);
    });

    it('hides icon when loading', () => {
      const { queryByTestId } = renderButton({
        icon: <TestIcon />,
        loading: true
      });
      
      expect(queryByTestId(TEST_IDS.icon)).not.toBeInTheDocument();
      expect(queryByTestId(TEST_IDS.spinner)).toBeInTheDocument();
    });
  });
});