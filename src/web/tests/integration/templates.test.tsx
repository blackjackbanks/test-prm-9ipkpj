import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';

import TemplateList from '../../src/components/templates/TemplateList';
import { templateHandlers } from '../mocks/handlers';
import { mockTemplate, mockTemplateWithContent } from '../mocks/data';
import { lightTheme } from '../../src/styles/theme';
import templateReducer from '../../src/store/slices/templateSlice';
import { TemplateCategory } from '../../src/types/template';

// Test server setup with MSW
const server = setupServer(...templateHandlers);

// Custom render function with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: { templates: templateReducer },
      preloadedState
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <ThemeProvider theme={lightTheme}>
        {children}
      </ThemeProvider>
    </Provider>
  );
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};

// Test suite setup
describe('Template List Integration Tests', () => {
  // Setup and teardown
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });
  afterAll(() => server.close());

  // Accessibility tests
  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 AA standards for keyboard navigation', async () => {
      renderWithProviders(<TemplateList />);

      // Test tab navigation
      const user = userEvent.setup();
      await user.tab();
      expect(screen.getByRole('searchbox')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('combobox')).toHaveFocus();
      
      await user.tab();
      const firstTemplate = screen.getAllByRole('article')[0];
      expect(firstTemplate).toHaveFocus();
    });

    it('should provide proper ARIA labels and roles', async () => {
      renderWithProviders(<TemplateList />);

      expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label', 'Search templates');
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Filter by category');
      expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Template grid');
    });

    it('should announce loading and error states to screen readers', async () => {
      renderWithProviders(<TemplateList />);

      // Test loading state
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading templates');

      // Test error state
      server.use(
        rest.get('/api/v1/templates', (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  // Template interaction tests
  describe('Template Interactions', () => {
    it('should filter templates by search text', async () => {
      const { store } = renderWithProviders(<TemplateList />);
      const user = userEvent.setup();

      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'sales');

      await waitFor(() => {
        const templates = screen.getAllByRole('article');
        expect(templates.length).toBe(1);
        expect(templates[0]).toHaveTextContent('Sales Pipeline Template');
      });
    });

    it('should filter templates by category', async () => {
      renderWithProviders(<TemplateList />);
      const user = userEvent.setup();

      const categorySelect = screen.getByRole('combobox');
      await user.click(categorySelect);
      await user.click(screen.getByText('Sales'));

      await waitFor(() => {
        const templates = screen.getAllByRole('article');
        expect(templates.length).toBe(1);
        expect(templates[0]).toHaveAttribute('data-category', TemplateCategory.SALES);
      });
    });

    it('should handle template preview and use actions', async () => {
      renderWithProviders(<TemplateList />);
      const user = userEvent.setup();

      const template = screen.getAllByRole('article')[0];
      const previewButton = within(template).getByRole('button', { name: /preview/i });
      const useButton = within(template).getByRole('button', { name: /use template/i });

      await user.click(previewButton);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(useButton);
      expect(screen.getByRole('alert')).toHaveTextContent('Template deployment started');
    });
  });

  // Performance tests
  describe('Performance Optimization', () => {
    it('should efficiently render large template lists', async () => {
      const templates = Array.from({ length: 100 }, (_, i) => ({
        ...mockTemplate,
        id: `tpl_${i}`,
        name: `Template ${i}`
      }));

      server.use(
        rest.get('/api/v1/templates', (req, res, ctx) => {
          return res(ctx.json({ data: templates }));
        })
      );

      const { container } = renderWithProviders(<TemplateList />);
      
      // Measure render time
      const start = performance.now();
      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      });
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should render within 1 second
      expect(container).toMatchSnapshot();
    });

    it('should debounce search input', async () => {
      const searchSpy = jest.fn();
      server.use(
        rest.get('/api/v1/templates', (req, res, ctx) => {
          searchSpy();
          return res(ctx.json({ data: [mockTemplate] }));
        })
      );

      renderWithProviders(<TemplateList />);
      const user = userEvent.setup();

      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test query');

      // Should only make one API call after debounce
      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      server.use(
        rest.get('/api/v1/templates', (req, res) => {
          return res.networkError('Failed to connect');
        })
      );

      renderWithProviders(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
    });

    it('should handle validation errors', async () => {
      renderWithProviders(<TemplateList />);
      const user = userEvent.setup();

      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, ''.repeat(151)); // Exceed max length

      expect(screen.getByRole('alert')).toHaveTextContent('Search query too long');
    });

    it('should handle rate limiting', async () => {
      server.use(
        rest.get('/api/v1/templates', (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({ message: 'Too many requests' })
          );
        })
      );

      renderWithProviders(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Too many requests');
      });
    });

    it('should recover from errors when retrying', async () => {
      let attempts = 0;
      server.use(
        rest.get('/api/v1/templates', (req, res, ctx) => {
          attempts++;
          return attempts < 2
            ? res(ctx.status(500))
            : res(ctx.json({ data: [mockTemplate] }));
        })
      );

      renderWithProviders(<TemplateList />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getAllByRole('article')).toHaveLength(1);
      });
    });
  });
});