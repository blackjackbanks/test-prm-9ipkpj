/**
 * Global test setup configuration for frontend testing environment
 * Configures Jest with required mocks, polyfills, and testing utilities
 * @version 1.0.0
 */

import '@testing-library/jest-dom/extend-expect'; // v5.16.5
import { cleanup } from '@testing-library/react'; // v14.0.0
import { setupServer } from 'msw/node'; // v1.2.0
import { authHandlers, integrationHandlers, templateHandlers } from './mocks/handlers';

// Configure MSW server with all handlers
const server = setupServer(
  ...authHandlers,
  ...integrationHandlers,
  ...templateHandlers
);

// Configure global mocks
const configureMocks = () => {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  };

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
    root = null;
    rootMargin = '';
    thresholds = [];
  };

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

  // Suppress console errors/warnings during tests
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: any[]) => {
    if (
      /Warning.*not wrapped in act/.test(args[0]) ||
      /Warning.*cannot update a component/.test(args[0])
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  console.warn = (...args: any[]) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalWarn.call(console, ...args);
  };
};

// Configure test environment
beforeAll(() => {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'error'
  });

  // Configure global mocks
  configureMocks();
});

// Reset handlers between tests
afterEach(() => {
  // Clean up after each test
  cleanup();
  
  // Reset MSW handlers
  server.resetHandlers();
  
  // Clear localStorage and sessionStorage
  window.localStorage.clear();
  window.sessionStorage.clear();
  
  // Reset all mocks
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  // Close MSW server
  server.close();
});

// Configure Jest timeout
jest.setTimeout(10000);

// Export server for individual test usage
export { server };

// Configure custom Jest matchers
expect.extend({
  toHaveBeenCalledWithMatch(received: jest.Mock, expected: any) {
    const pass = received.mock.calls.some(call =>
      JSON.stringify(call[0]).includes(JSON.stringify(expected))
    );
    return {
      pass,
      message: () =>
        `expected ${received.getMockName()} to have been called with an object matching ${JSON.stringify(
          expected
        )}`,
    };
  },
});

// Export test utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';