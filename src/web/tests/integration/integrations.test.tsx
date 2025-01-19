import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { setupServer } from 'msw/node';
import { toHaveNoViolations } from 'jest-axe';
import { configureStore } from '@reduxjs/toolkit';

import IntegrationList from '../../src/components/integrations/IntegrationList';
import IntegrationConfig from '../../src/components/integrations/IntegrationConfig';
import { mockIntegration, mockIntegrationSyncResult } from '../mocks/data';
import { integrationHandlers } from '../mocks/handlers';
import { IntegrationStatus, IntegrationType } from '../../src/types/integration';

// Set up MSW server
const server = setupServer(...integrationHandlers);

// Configure test store
const mockStore = configureStore({
  reducer: {
    integrations: (state = { integrations: [], loading: false, error: null }) => state
  }
});

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

describe('Integration Management Interface', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe('IntegrationList Component', () => {
    const renderIntegrationList = () => {
      return render(
        <Provider store={mockStore}>
          <IntegrationList
            onEdit={jest.fn()}
            onSync={jest.fn()}
            onTest={jest.fn()}
          />
        </Provider>
      );
    };

    it('should handle loading state correctly', async () => {
      renderIntegrationList();

      // Check for loading skeleton
      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.getAllByRole('presentation')).toHaveLength(6);

      // Wait for content to load
      await waitFor(() => {
        expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
      });
    });

    it('should display integration cards with correct information', async () => {
      renderIntegrationList();

      await waitFor(() => {
        const card = screen.getByRole('article', {
          name: new RegExp(mockIntegration.name, 'i')
        });
        expect(card).toBeInTheDocument();
        
        // Check card content
        expect(within(card).getByText(mockIntegration.name)).toBeInTheDocument();
        expect(within(card).getByText(mockIntegration.type)).toBeInTheDocument();
        expect(within(card).getByText(/active/i)).toBeInTheDocument();
      });
    });

    it('should filter integrations correctly', async () => {
      renderIntegrationList();

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText(mockIntegration.name)).toBeInTheDocument();
      });

      // Test type filter
      const typeFilter = screen.getByRole('combobox', {
        name: /filter integrations by type/i
      });
      await userEvent.selectOptions(typeFilter, IntegrationType.CRM);

      // Test status filter
      const statusFilter = screen.getByRole('combobox', {
        name: /filter integrations by status/i
      });
      await userEvent.selectOptions(statusFilter, 'active');

      // Test search
      const searchInput = screen.getByRole('searchbox');
      await userEvent.type(searchInput, 'Salesforce');

      // Verify filtered results
      expect(screen.getByText(mockIntegration.name)).toBeInTheDocument();
    });

    it('should meet accessibility requirements', async () => {
      const { container } = renderIntegrationList();
      
      await waitFor(() => {
        expect(screen.getByText(mockIntegration.name)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('IntegrationConfig Component', () => {
    const mockOnSave = jest.fn();
    const mockOnTest = jest.fn();

    const renderIntegrationConfig = () => {
      return render(
        <Provider store={mockStore}>
          <IntegrationConfig
            integration={mockIntegration}
            onSave={mockOnSave}
            onTest={mockOnTest}
          />
        </Provider>
      );
    };

    it('should validate form inputs correctly', async () => {
      renderIntegrationConfig();

      // Test API Key validation
      const apiKeyInput = screen.getByLabelText(/api key/i);
      await userEvent.clear(apiKeyInput);
      await userEvent.tab();
      expect(screen.getByText(/api key is required/i)).toBeInTheDocument();

      // Test API URL validation
      const apiUrlInput = screen.getByLabelText(/api url/i);
      await userEvent.clear(apiUrlInput);
      await userEvent.type(apiUrlInput, 'invalid-url');
      await userEvent.tab();
      expect(screen.getByText(/invalid url format/i)).toBeInTheDocument();
    });

    it('should handle form submission correctly', async () => {
      renderIntegrationConfig();

      // Fill form with valid data
      const apiKeyInput = screen.getByLabelText(/api key/i);
      const apiUrlInput = screen.getByLabelText(/api url/i);

      await userEvent.type(apiKeyInput, 'valid-api-key');
      await userEvent.type(apiUrlInput, 'https://api.example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /save configuration/i });
      await userEvent.click(submitButton);

      // Verify submission
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
          apiKey: 'valid-api-key',
          apiUrl: 'https://api.example.com'
        }));
      });
    });

    it('should handle test connection functionality', async () => {
      renderIntegrationConfig();

      const testButton = screen.getByRole('button', { name: /test connection/i });
      await userEvent.click(testButton);

      // Verify loading state
      expect(testButton).toBeDisabled();
      expect(screen.getByText(/testing/i)).toBeInTheDocument();

      // Verify test completion
      await waitFor(() => {
        expect(mockOnTest).toHaveBeenCalledWith(expect.objectContaining({
          success: true
        }));
      });
    });

    it('should handle error states gracefully', async () => {
      // Mock error response
      server.use(
        rest.post('/api/v1/integrations/test', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ message: 'Test connection failed' })
          );
        })
      );

      renderIntegrationConfig();

      const testButton = screen.getByRole('button', { name: /test connection/i });
      await userEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/test connection failed/i)).toBeInTheDocument();
      });
    });

    it('should meet accessibility requirements', async () => {
      const { container } = renderIntegrationConfig();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});