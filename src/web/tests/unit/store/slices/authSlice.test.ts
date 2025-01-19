import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import { setupServer } from 'msw';
import { rest } from 'msw';

import reducer, {
  login,
  verifyMFA,
  refreshToken,
  updateSecurityPreferences,
  logout,
  recordSecurityEvent,
  clearSecurityEvents,
  resetFailedAttempts,
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectMFAStatus,
  selectSecurityEvents,
  selectAuthLoadingState,
  selectAuthError
} from '../../../../src/store/slices/authSlice';

import { 
  AuthState, 
  LoadingState, 
  MFAType,
  User,
  AuthError
} from '../../../../src/types/auth';

// Mock API handlers
const server = setupServer(
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        user: { id: '123', email: 'test@example.com', name: 'Test User' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        mfaRequired: true
      })
    );
  }),
  
  rest.post('/api/auth/mfa/verify', (req, res, ctx) => {
    return res(
      ctx.json({
        accessToken: 'mock-mfa-token',
        mfaType: MFAType.TOTP
      })
    );
  }),
  
  rest.post('/api/auth/token/refresh', (req, res, ctx) => {
    return res(
      ctx.json({
        accessToken: 'mock-new-token',
        refreshToken: 'mock-new-refresh',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      })
    );
  })
);

// Test store setup
const mockInitialState: AuthState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  loadingState: LoadingState.IDLE,
  error: null,
  mfaRequired: false,
  mfaVerified: false,
  securityEvents: [],
  lastLoginAt: null,
  failedLoginAttempts: 0,
  tokenExpiresAt: null
};

const mockStore = configureStore({
  reducer: { auth: reducer },
  preloadedState: { auth: mockInitialState }
});

describe('authSlice', () => {
  beforeEach(() => {
    server.listen();
    mockStore.dispatch(clearSecurityEvents());
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('initial state', () => {
    test('should return the initial state', () => {
      const state = mockStore.getState().auth;
      expect(state).toEqual(mockInitialState);
    });
  });

  describe('authentication flows', () => {
    test('should handle successful login with MFA required', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      
      await mockStore.dispatch(login(credentials));
      const state = mockStore.getState().auth;
      
      expect(state.loadingState).toBe(LoadingState.SUCCESS);
      expect(state.user).toBeTruthy();
      expect(state.accessToken).toBe('mock-access-token');
      expect(state.mfaRequired).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.securityEvents).toHaveLength(1);
      expect(state.securityEvents[0].type).toBe('LOGIN_SUCCESS');
    });

    test('should handle failed login attempt', async () => {
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ 
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            })
          );
        })
      );

      const credentials = { email: 'wrong@example.com', password: 'wrongpass' };
      
      await mockStore.dispatch(login(credentials));
      const state = mockStore.getState().auth;
      
      expect(state.loadingState).toBe(LoadingState.ERROR);
      expect(state.error).toBeTruthy();
      expect(state.failedLoginAttempts).toBe(1);
      expect(state.securityEvents[0].type).toBe('LOGIN_FAILURE');
    });

    test('should handle successful MFA verification', async () => {
      // First login to set up MFA requirement
      await mockStore.dispatch(login({ 
        email: 'test@example.com', 
        password: 'password123' 
      }));

      const mfaCredentials = {
        type: MFAType.TOTP,
        code: '123456',
        token: 'mock-access-token'
      };

      await mockStore.dispatch(verifyMFA(mfaCredentials));
      const state = mockStore.getState().auth;

      expect(state.mfaVerified).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('mock-mfa-token');
      expect(state.securityEvents).toContainEqual(
        expect.objectContaining({ type: 'MFA_SUCCESS' })
      );
    });

    test('should handle failed MFA verification', async () => {
      server.use(
        rest.post('/api/auth/mfa/verify', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ 
              code: 'INVALID_MFA_CODE',
              message: 'Invalid verification code'
            })
          );
        })
      );

      const mfaCredentials = {
        type: MFAType.TOTP,
        code: 'wrong-code',
        token: 'mock-access-token'
      };

      await mockStore.dispatch(verifyMFA(mfaCredentials));
      const state = mockStore.getState().auth;

      expect(state.mfaVerified).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeTruthy();
      expect(state.securityEvents).toContainEqual(
        expect.objectContaining({ type: 'MFA_FAILURE' })
      );
    });
  });

  describe('token management', () => {
    test('should handle successful token refresh', async () => {
      // Set initial tokens
      mockStore.dispatch({
        type: 'auth/login/fulfilled',
        payload: {
          accessToken: 'old-token',
          refreshToken: 'old-refresh',
          user: { id: '123' }
        }
      });

      await mockStore.dispatch(refreshToken());
      const state = mockStore.getState().auth;

      expect(state.accessToken).toBe('mock-new-token');
      expect(state.refreshToken).toBe('mock-new-refresh');
      expect(state.securityEvents).toContainEqual(
        expect.objectContaining({ type: 'TOKEN_REFRESH' })
      );
    });

    test('should handle failed token refresh', async () => {
      server.use(
        rest.post('/api/auth/token/refresh', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ 
              code: 'INVALID_REFRESH_TOKEN',
              message: 'Refresh token expired'
            })
          );
        })
      );

      await mockStore.dispatch(refreshToken());
      const state = mockStore.getState().auth;

      expect(state.error).toBeTruthy();
      expect(state.error?.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('security event tracking', () => {
    test('should track security events', () => {
      const securityEvent = {
        type: 'SECURITY_UPDATE',
        timestamp: new Date(),
        details: { 
          action: 'MFA_ENABLED',
          userId: '123'
        }
      };

      mockStore.dispatch(recordSecurityEvent(securityEvent));
      const state = mockStore.getState().auth;

      expect(state.securityEvents).toContainEqual(securityEvent);
    });

    test('should clear security events', () => {
      // Add some events first
      mockStore.dispatch(recordSecurityEvent({
        type: 'SECURITY_UPDATE',
        timestamp: new Date(),
        details: {}
      }));

      mockStore.dispatch(clearSecurityEvents());
      const state = mockStore.getState().auth;

      expect(state.securityEvents).toHaveLength(0);
    });

    test('should track failed login attempts', async () => {
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ code: 'INVALID_CREDENTIALS' })
          );
        })
      );

      await mockStore.dispatch(login({ 
        email: 'test@example.com', 
        password: 'wrong' 
      }));
      await mockStore.dispatch(login({ 
        email: 'test@example.com', 
        password: 'wrong' 
      }));

      const state = mockStore.getState().auth;
      expect(state.failedLoginAttempts).toBe(2);
    });
  });

  describe('selectors', () => {
    test('should select auth state', () => {
      const state = mockStore.getState();
      expect(selectAuth(state)).toEqual(state.auth);
    });

    test('should select user', () => {
      const state = mockStore.getState();
      expect(selectUser(state)).toEqual(state.auth.user);
    });

    test('should select MFA status', () => {
      const state = mockStore.getState();
      expect(selectMFAStatus(state)).toEqual({
        required: state.auth.mfaRequired,
        verified: state.auth.mfaVerified
      });
    });

    test('should select security events', () => {
      const state = mockStore.getState();
      expect(selectSecurityEvents(state)).toEqual(state.auth.securityEvents);
    });
  });

  describe('logout', () => {
    test('should handle logout and preserve security events', () => {
      // Set up authenticated state
      mockStore.dispatch({
        type: 'auth/login/fulfilled',
        payload: {
          user: { id: '123' },
          accessToken: 'token',
          refreshToken: 'refresh'
        }
      });

      // Record a security event
      mockStore.dispatch(recordSecurityEvent({
        type: 'SECURITY_UPDATE',
        timestamp: new Date(),
        details: {}
      }));

      mockStore.dispatch(logout());
      const state = mockStore.getState().auth;

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.securityEvents).toHaveLength(2); // Previous event + logout event
      expect(state.securityEvents[1].type).toBe('LOGOUT');
    });
  });
});