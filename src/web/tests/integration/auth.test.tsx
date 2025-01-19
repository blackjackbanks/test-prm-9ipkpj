import { render, screen, waitFor } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { rest } from 'msw'; // ^1.2.0
import { setupServer } from 'msw/node'; // ^1.2.0
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useAuth } from '../../src/hooks/useAuth';
import { AuthTypes } from '../../src/types/auth';
import authReducer from '../../src/store/slices/authSlice';

// Mock user data
const mockUser: AuthTypes.User = {
  id: 'test-user-123',
  email: 'test@coreos.com',
  name: 'Test User',
  preferences: {},
  mfaEnabled: true,
  mfaType: AuthTypes.MFAType.TOTP,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1
};

// Mock tokens
const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600
};

// Mock security events tracking
const mockSecurityEvents: AuthTypes.SecurityEvent[] = [];

// Setup MSW server for API mocking
const server = setupServer(
  // Login endpoint
  rest.post('/api/v1/auth/login', (req, res, ctx) => {
    const { email, password } = req.body as AuthTypes.LoginCredentials;
    if (email === 'test@coreos.com' && password === 'valid-password') {
      return res(
        ctx.status(200),
        ctx.json({
          user: mockUser,
          mfaRequired: true,
          ...mockTokens
        })
      );
    }
    return res(
      ctx.status(401),
      ctx.json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      })
    );
  }),

  // MFA verification endpoint
  rest.post('/api/v1/auth/mfa/verify', (req, res, ctx) => {
    const { code } = req.body as AuthTypes.MFACredentials;
    if (code === '123456') {
      return res(
        ctx.status(200),
        ctx.json({
          user: mockUser,
          ...mockTokens
        })
      );
    }
    return res(
      ctx.status(401),
      ctx.json({
        code: 'INVALID_MFA_CODE',
        message: 'Invalid MFA code'
      })
    );
  }),

  // OAuth endpoints
  rest.post('/api/v1/auth/oauth/:provider', (req, res, ctx) => {
    const { provider } = req.params;
    return res(
      ctx.status(200),
      ctx.json({
        url: `https://oauth.provider.com/authorize?client_id=mock-client-id&provider=${provider}`
      })
    );
  }),

  // Token refresh endpoint
  rest.post('/api/v1/auth/token/refresh', (req, res, ctx) => {
    const { refreshToken } = req.body;
    if (refreshToken === mockTokens.refreshToken) {
      return res(
        ctx.status(200),
        ctx.json({
          ...mockTokens,
          accessToken: 'new-access-token'
        })
      );
    }
    return res(
      ctx.status(401),
      ctx.json({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token'
      })
    );
  })
);

// Test component using auth hook
const TestAuthComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <button onClick={() => auth.login({ email: 'test@coreos.com', password: 'valid-password' })}>
        Login
      </button>
      <button onClick={() => auth.loginWithOAuth(AuthTypes.OAuthProvider.GOOGLE)}>
        Google Login
      </button>
      <button onClick={() => auth.verifyMFA('123456')}>
        Verify MFA
      </button>
      <button onClick={auth.logout}>
        Logout
      </button>
    </div>
  );
};

describe('Authentication Flow', () => {
  // Setup store and server
  let store: ReturnType<typeof configureStore>;

  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer
      }
    });
  });

  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  test('successful login with MFA verification', async () => {
    render(
      <Provider store={store}>
        <TestAuthComponent />
      </Provider>
    );

    // Trigger login
    await userEvent.click(screen.getByText('Login'));

    // Verify initial login response
    await waitFor(() => {
      const state = store.getState().auth;
      expect(state.user).toEqual(mockUser);
      expect(state.mfaRequired).toBe(true);
      expect(state.isAuthenticated).toBe(false);
    });

    // Verify MFA
    await userEvent.click(screen.getByText('Verify MFA'));

    // Verify successful authentication
    await waitFor(() => {
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.mfaVerified).toBe(true);
      expect(state.accessToken).toBeTruthy();
    });
  });

  test('OAuth authentication flow', async () => {
    render(
      <Provider store={store}>
        <TestAuthComponent />
      </Provider>
    );

    // Mock window.location.assign
    const mockAssign = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { assign: mockAssign },
      writable: true
    });

    // Trigger OAuth login
    await userEvent.click(screen.getByText('Google Login'));

    // Verify OAuth redirect
    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith(
        expect.stringContaining('https://oauth.provider.com/authorize')
      );
    });
  });

  test('token refresh with rate limiting', async () => {
    render(
      <Provider store={store}>
        <TestAuthComponent />
      </Provider>
    );

    // Setup authenticated state
    store.dispatch({
      type: 'auth/login/fulfilled',
      payload: {
        user: mockUser,
        ...mockTokens
      }
    });

    // Mock time passage
    jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

    // Verify token refresh
    await waitFor(() => {
      const state = store.getState().auth;
      expect(state.accessToken).toBe('new-access-token');
    });
  });

  test('failed login with security event tracking', async () => {
    render(
      <Provider store={store}>
        <TestAuthComponent />
      </Provider>
    );

    // Override login handler for failure
    server.use(
      rest.post('/api/v1/auth/login', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          })
        );
      })
    );

    // Trigger failed login
    await userEvent.click(screen.getByText('Login'));

    // Verify security event tracking
    await waitFor(() => {
      const state = store.getState().auth;
      expect(state.securityEvents).toHaveLength(1);
      expect(state.securityEvents[0].type).toBe('LOGIN_FAILURE');
    });
  });
});