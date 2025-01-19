import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import 'jest-styled-components';

import AppLayout from '../../../../src/components/layout/AppLayout';
import useBreakpoint from '../../../../src/hooks/useBreakpoint';
import { lightTheme, darkTheme } from '../../../../src/styles/theme';

// Mock required hooks and components
jest.mock('../../../../src/hooks/useBreakpoint');
jest.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { name: 'Test User', preferences: {} },
    isAuthenticated: true,
    mfaStatus: { required: false, verified: true }
  })
}));

// Mock ResizeObserver
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));
window.ResizeObserver = mockResizeObserver;

// Helper function to render component with required providers
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
  };
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

  return render(
    <ThemeProvider theme={lightTheme}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </ThemeProvider>,
    options
  );
};

describe('AppLayout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBreakpoint as jest.Mock).mockReturnValue('desktop');
  });

  describe('Core Layout Structure', () => {
    it('renders all main layout components correctly', () => {
      renderWithProviders(<AppLayout />);

      // Verify Header presence
      expect(screen.getByRole('banner')).toBeInTheDocument();

      // Verify Sidebar presence
      expect(screen.getByRole('navigation')).toBeInTheDocument();

      // Verify main content area
      const mainContent = screen.getByRole('main');
      expect(mainContent).toBeInTheDocument();
      expect(mainContent).toHaveAttribute('aria-label', 'Main content');

      // Verify ChatInterface presence
      expect(screen.getByRole('region', { name: /chat/i })).toBeInTheDocument();

      // Verify CommandBar presence
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('applies correct spacing and layout based on theme', () => {
      const { container } = renderWithProviders(<AppLayout />);

      // Verify grid spacing
      expect(container.firstChild).toHaveStyleRule('padding', lightTheme.spacing.scale.lg);
      expect(container.firstChild).toHaveStyleRule('margin-left', '240px', {
        media: '(min-width: 768px)'
      });
    });

    it('maintains proper accessibility landmarks', () => {
      renderWithProviders(<AppLayout />);

      // Verify ARIA landmarks
      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // Sidebar
      expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
      expect(screen.getByRole('complementary')).toBeInTheDocument(); // CommandBar
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts layout for mobile viewport', () => {
      (useBreakpoint as jest.Mock).mockReturnValue('mobile');
      const { container } = renderWithProviders(<AppLayout />);

      expect(container.firstChild).toHaveStyleRule('margin-left', '0', {
        media: '(max-width: 768px)'
      });
    });

    it('adjusts layout for tablet viewport', () => {
      (useBreakpoint as jest.Mock).mockReturnValue('tablet');
      renderWithProviders(<AppLayout />);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveStyleRule('width', '64px', {
        modifier: '[data-collapsed="true"]'
      });
    });

    it('handles sidebar collapse state correctly', async () => {
      renderWithProviders(<AppLayout />);

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      await userEvent.click(toggleButton);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Theme Support', () => {
    it('applies light theme styles correctly', () => {
      const { container } = renderWithProviders(<AppLayout />);

      expect(container.firstChild).toHaveStyleRule('background', lightTheme.colors.background);
    });

    it('applies dark theme styles correctly', () => {
      const { container } = renderWithProviders(
        <ThemeProvider theme={darkTheme}>
          <AppLayout />
        </ThemeProvider>
      );

      expect(container.firstChild).toHaveStyleRule('background', darkTheme.colors.background);
    });

    it('persists theme preference', async () => {
      renderWithProviders(<AppLayout />);

      const themeToggle = screen.getByRole('button', { name: /toggle theme/i });
      await userEvent.click(themeToggle);

      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  describe('Component Integration', () => {
    it('integrates Header component with correct props', () => {
      renderWithProviders(<AppLayout />);
      const header = screen.getByRole('banner');
      
      expect(within(header).getByText('COREos')).toBeInTheDocument();
      expect(within(header).getByRole('button', { name: /profile/i })).toBeInTheDocument();
    });

    it('integrates Sidebar component with correct props', () => {
      renderWithProviders(<AppLayout />);
      const sidebar = screen.getByRole('navigation');

      expect(sidebar).toHaveAttribute('aria-expanded', 'true');
      expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument();
    });

    it('integrates ChatInterface with correct props', () => {
      renderWithProviders(<AppLayout />);
      const chat = screen.getByRole('region', { name: /chat/i });

      expect(chat).toHaveAttribute('data-position', 'minimized');
    });

    it('handles keyboard shortcuts correctly', async () => {
      renderWithProviders(<AppLayout />);

      // Test sidebar toggle shortcut
      fireEvent.keyDown(document, { key: 'b', metaKey: true });
      await waitFor(() => {
        const sidebar = screen.getByRole('navigation');
        expect(sidebar).toHaveAttribute('aria-expanded', 'false');
      });

      // Test chat toggle shortcut
      fireEvent.keyDown(document, { key: 'j', metaKey: true });
      await waitFor(() => {
        const chat = screen.getByRole('region', { name: /chat/i });
        expect(chat).toHaveAttribute('data-position', 'expanded');
      });
    });
  });

  describe('Error Handling', () => {
    it('renders error boundary fallback on error', () => {
      const ThrowError = () => {
        throw new Error('Test error');
        return null;
      };

      renderWithProviders(
        <AppLayout>
          <ThrowError />
        </AppLayout>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Error Loading Layout/i)).toBeInTheDocument();
    });
  });
});