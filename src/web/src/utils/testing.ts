/**
 * Comprehensive testing utility module providing type-safe test helpers, mock implementations,
 * and reusable test setup functions for React components, Redux store, and external integrations.
 * @version 1.0.0
 */

import { render, RenderResult } from '@testing-library/react'; // v14.0.0
import { configureStore, DeepPartial } from '@reduxjs/toolkit'; // v1.9.0
import { Provider } from 'react-redux'; // v8.1.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import type { RootState } from '@reduxjs/toolkit';

import { mockUser } from '../../tests/mocks/data';
import type { ApiResponse } from '../types/common';

// Global test configuration constants
export const TEST_TIMEOUT = 5000;
export const MOCK_API_DELAY = 100;

// Default Redux store state for testing
export const DEFAULT_STORE_STATE: DeepPartial<RootState> = {
  auth: {
    user: null,
    loading: false,
    error: null,
    tokens: null
  },
  ui: {
    theme: 'light',
    loading: false,
    modal: null,
    notifications: []
  }
};

/**
 * Enhanced render utility that wraps components with Redux Provider and custom store state
 * @param ui - React component to render
 * @param preloadedState - Initial Redux state
 * @param storeOptions - Additional store configuration options
 * @returns Extended render result with store reference
 */
export function renderWithProviders(
  ui: React.ReactElement,
  preloadedState: DeepPartial<RootState> = DEFAULT_STORE_STATE,
  storeOptions = {}
): RenderResult & { store: any } {
  const store = configureStore({
    reducer: {
      auth: (state = preloadedState.auth) => state,
      ui: (state = preloadedState.ui) => state
    },
    preloadedState,
    ...storeOptions
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper })
  };
}

/**
 * Type-safe factory function for creating mock API responses
 * @template T - Type of response data
 * @param data - Response payload
 * @param success - Response success status
 * @param error - Optional error details
 * @returns Typed API response matching backend structure
 */
export function createMockApiResponse<T>(
  data: T,
  success = true,
  error?: { code: string; message: string }
): ApiResponse<T> {
  return {
    success,
    message: success ? 'Success' : error?.message || 'Error',
    data,
    timestamp: new Date(),
    ...(error && { error })
  };
}

/**
 * Comprehensive localStorage mock with type-safe methods
 * @param initialState - Initial storage state
 */
export function mockLocalStorage(initialState: Record<string, string> = {}) {
  let store = { ...initialState };

  const localStorageMock = {
    getItem: (key: string): string | null => {
      return store[key] || null;
    },
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    key: (index: number): string | null => {
      return Object.keys(store)[index] || null;
    },
    get length(): number {
      return Object.keys(store).length;
    }
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });

  return localStorageMock;
}

/**
 * Feature-complete WebSocket mock for testing real-time features
 * @param config - WebSocket configuration
 * @returns Mock WebSocket instance with testing utilities
 */
export function mockWebSocket(config: {
  url: string;
  protocols?: string | string[];
}) {
  class MockWebSocket implements WebSocket {
    public url: string;
    public protocol: string;
    public readyState: number;
    public bufferedAmount: number;
    public extensions: string;
    public binaryType: BinaryType;
    private listeners: Record<string, Function[]>;

    constructor(url: string, protocols?: string | string[]) {
      this.url = url;
      this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
      this.readyState = WebSocket.CONNECTING;
      this.bufferedAmount = 0;
      this.extensions = '';
      this.binaryType = 'blob';
      this.listeners = {};

      // Simulate connection
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        this.dispatchEvent(new Event('open'));
      }, 0);
    }

    addEventListener(type: string, listener: Function): void {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(listener);
    }

    removeEventListener(type: string, listener: Function): void {
      if (this.listeners[type]) {
        this.listeners[type] = this.listeners[type].filter(l => l !== listener);
      }
    }

    dispatchEvent(event: Event): boolean {
      const listeners = this.listeners[event.type] || [];
      listeners.forEach(listener => listener(event));
      return true;
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
      if (this.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not open');
      }
      // Simulate message echo for testing
      setTimeout(() => {
        const messageEvent = new MessageEvent('message', { data });
        this.dispatchEvent(messageEvent);
      }, MOCK_API_DELAY);
    }

    close(code?: number, reason?: string): void {
      this.readyState = WebSocket.CLOSING;
      setTimeout(() => {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(new CloseEvent('close', { code, reason }));
      }, 0);
    }

    // WebSocket static values
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    // Test helper methods
    simulateError(error: Error): void {
      this.dispatchEvent(new ErrorEvent('error', { error }));
    }

    simulateMessage(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
      this.dispatchEvent(new MessageEvent('message', { data }));
    }
  }

  return new MockWebSocket(config.url, config.protocols);
}

/**
 * User event simulation helper with common interaction patterns
 */
export const userActions = {
  async type(element: Element, text: string): Promise<void> {
    await userEvent.type(element, text);
  },

  async click(element: Element): Promise<void> {
    await userEvent.click(element);
  },

  async selectOption(element: Element, option: string): Promise<void> {
    await userEvent.selectOptions(element, option);
  },

  async upload(element: Element, file: File): Promise<void> {
    await userEvent.upload(element, file);
  }
};

/**
 * Common test data factory functions
 */
export const testData = {
  getTestUser: () => ({ ...mockUser }),
  getAuthState: (authenticated = true) => ({
    user: authenticated ? mockUser : null,
    isAuthenticated: authenticated,
    accessToken: authenticated ? 'test-token' : null,
    refreshToken: authenticated ? 'test-refresh-token' : null,
    loading: false,
    error: null
  })
};