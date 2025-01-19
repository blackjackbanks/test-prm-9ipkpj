/**
 * Mock Service Worker (MSW) request handlers for API testing
 * Provides comprehensive test coverage for all API endpoints
 * @version 1.0.0
 */

import { rest } from 'msw'; // v1.2.0
import { HttpResponse, delay } from 'msw'; // v1.2.0
import { API_ENDPOINTS, HTTP_STATUS } from '@constants'; // v1.0.0

import {
  mockUser,
  mockAuthResponse,
  mockIntegration,
  mockTemplate,
  mockAuthState,
  mockIntegrationSyncResult
} from './data';

/**
 * Creates a standardized error response
 * @param status HTTP status code
 * @param message Error message
 * @param details Additional error details
 */
const createErrorResponse = (
  status: number,
  message: string,
  details?: Record<string, unknown>
) => {
  return new HttpResponse(
    JSON.stringify({
      success: false,
      code: `ERR_${status}`,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId: `req_${Math.random().toString(36).substring(7)}`
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};

/**
 * Simulates network conditions for realistic testing
 * @param condition Network condition type
 */
const simulateNetworkCondition = async (condition: 'normal' | 'slow' | 'flaky') => {
  switch (condition) {
    case 'slow':
      await delay(2000);
      break;
    case 'flaky':
      if (Math.random() > 0.7) {
        throw new Error('Network error');
      }
      await delay(Math.random() * 1000);
      break;
    default:
      await delay(100);
  }
};

// Authentication Handlers
export const authHandlers = [
  // Login Handler
  rest.post(API_ENDPOINTS.AUTH.LOGIN, async (req, res, ctx) => {
    await simulateNetworkCondition('normal');
    const { email, password } = await req.json();

    if (!email || !password) {
      return createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Email and password are required'
      );
    }

    if (email === 'error@test.com') {
      return createErrorResponse(
        HTTP_STATUS.UNAUTHORIZED,
        'Invalid credentials'
      );
    }

    return new HttpResponse(
      JSON.stringify({
        success: true,
        data: mockAuthResponse
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }),

  // MFA Verification Handler
  rest.post(API_ENDPOINTS.AUTH.MFA_VERIFY, async (req, res, ctx) => {
    const { code, token } = await req.json();

    if (!code || !token) {
      return createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'MFA code and token are required'
      );
    }

    if (code === '000000') {
      return createErrorResponse(
        HTTP_STATUS.UNAUTHORIZED,
        'Invalid MFA code'
      );
    }

    return new HttpResponse(
      JSON.stringify({
        success: true,
        data: mockAuthState
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }),

  // OAuth Handler
  rest.get(API_ENDPOINTS.AUTH.OAUTH, async (req, res, ctx) => {
    const provider = req.params.provider as string;

    if (!['google', 'microsoft', 'apple'].includes(provider)) {
      return createErrorResponse(
        HTTP_STATUS.BAD_REQUEST,
        'Invalid OAuth provider'
      );
    }

    return new HttpResponse(
      JSON.stringify({
        success: true,
        data: mockAuthState
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  })
];

// Integration Handlers
export const integrationHandlers = [
  // List Integrations Handler
  rest.get(API_ENDPOINTS.INTEGRATIONS.LIST, async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return createErrorResponse(
        HTTP_STATUS.UNAUTHORIZED,
        'Authentication required'
      );
    }

    return new HttpResponse(
      JSON.stringify({
        success: true,
        data: [mockIntegration]
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }),

  // Integration Sync Handler
  rest.post(API_ENDPOINTS.INTEGRATIONS.SYNC, async (req, res, ctx) => {
    const { id } = req.params;
    
    if (id === 'invalid_id') {
      return createErrorResponse(
        HTTP_STATUS.NOT_FOUND,
        'Integration not found'
      );
    }

    return new HttpResponse(
      JSON.stringify({
        success: true,
        data: mockIntegrationSyncResult
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  })
];

// Template Handlers
export const templateHandlers = [
  // List Templates Handler
  rest.get(API_ENDPOINTS.TEMPLATES.LIST, async (req, res, ctx) => {
    const category = req.url.searchParams.get('category');
    const isActive = req.url.searchParams.get('isActive');

    return new HttpResponse(
      JSON.stringify({
        success: true,
        data: [mockTemplate]
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }),

  // Deploy Template Handler
  rest.post(API_ENDPOINTS.TEMPLATES.DEPLOY, async (req, res, ctx) => {
    const { id } = req.params;
    const { version } = await req.json();

    if (id === 'invalid_id') {
      return createErrorResponse(
        HTTP_STATUS.NOT_FOUND,
        'Template not found'
      );
    }

    if (version !== mockTemplate.version) {
      return createErrorResponse(
        HTTP_STATUS.CONFLICT,
        'Template version mismatch'
      );
    }

    return new HttpResponse(
      JSON.stringify({
        success: true,
        data: mockTemplate
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  })
];

// Export all handlers
export const handlers = [
  ...authHandlers,
  ...integrationHandlers,
  ...templateHandlers
];