import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.0
import { waitFor } from '@testing-library/react'; // v14.0.0
import { mock } from 'jest-mock-extended'; // v3.0.0

import { useAuth } from '../../../src/hooks/useAuth';
import { renderWithProviders } from '../../../src/utils/testing';
import { mockUser, mockAuthResponse, mockAuthState } from '../../mocks/data';
import { 
  AuthError, 
  MFAType, 
  OAuthProvider, 
  LoadingState 
} from '../../../src/types/auth';

// Test constants
const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'password123'
};

const TEST_MFA_CODE = '123456';
const TEST_OAUTH_PROVIDER = OAuthProvider.GOOGLE;

describe('useAuth Hook', () => {
  // Setup and teardown
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('should handle successful login with credentials', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.error).toBeNull();
      });

      // Verify security event was logged
      expect(result.current.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'LOGIN_SUCCESS',
          details: expect.objectContaining({
            userId: mockUser.id
          })
        })
      );
    });

    it('should handle failed login attempts with rate limiting', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Simulate multiple failed login attempts
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          try {
            await result.current.login({
              email: 'wrong@example.com',
              password: 'wrongpass'
            });
          } catch (error) {
            expect(error).toBeDefined();
          }
        });
      }

      // Verify rate limiting kicks in
      await act(async () => {
        try {
          await result.current.login(TEST_CREDENTIALS);
          fail('Should have thrown rate limit error');
        } catch (error) {
          expect(error.message).toContain('Too many login attempts');
        }
      });

      // Verify security events were logged
      expect(result.current.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'LOGIN_FAILURE',
          details: expect.objectContaining({
            attemptCount: 3
          })
        })
      );
    });
  });

  describe('OAuth Authentication', () => {
    it('should handle successful OAuth login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      await act(async () => {
        await result.current.loginWithOAuth(TEST_OAUTH_PROVIDER);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });

      // Verify OAuth-specific security event
      expect(result.current.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'LOGIN_SUCCESS',
          details: expect.objectContaining({
            provider: TEST_OAUTH_PROVIDER
          })
        })
      );
    });
  });

  describe('MFA Verification', () => {
    it('should handle successful MFA verification', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children, {
          auth: {
            ...mockAuthState,
            mfaRequired: true,
            mfaVerified: false
          }
        })
      });

      await act(async () => {
        await result.current.verifyMFA(TEST_MFA_CODE);
      });

      await waitFor(() => {
        expect(result.current.mfaStatus.verified).toBe(true);
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Verify MFA security event
      expect(result.current.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'MFA_SUCCESS',
          details: expect.objectContaining({
            method: MFAType.TOTP
          })
        })
      );
    });

    it('should handle failed MFA verification', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children, {
          auth: {
            ...mockAuthState,
            mfaRequired: true,
            mfaVerified: false
          }
        })
      });

      await act(async () => {
        try {
          await result.current.verifyMFA('000000');
          fail('Should have thrown MFA verification error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.mfaStatus.verified).toBe(false);
      expect(result.current.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'MFA_FAILURE'
        })
      );
    });
  });

  describe('Token Management', () => {
    it('should handle automatic token refresh', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children, {
          auth: mockAuthState
        })
      });

      // Fast-forward past token refresh interval
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      });

      await waitFor(() => {
        expect(result.current.securityEvents).toContainEqual(
          expect.objectContaining({
            type: 'TOKEN_REFRESH'
          })
        );
      });

      jest.useRealTimers();
    });

    it('should handle token refresh failure with logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children, {
          auth: mockAuthState
        })
      });

      // Mock token refresh failure
      await act(async () => {
        try {
          await result.current.refreshToken();
          fail('Should have thrown token refresh error');
        } catch (error) {
          expect(error.code).toBe('TOKEN_INVALID');
        }
      });

      // Verify automatic logout
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Logout Flow', () => {
    it('should handle successful logout with cleanup', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children, {
          auth: mockAuthState
        })
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('lastLoginAttempt')).toBeNull();
      expect(sessionStorage.length).toBe(0);

      // Verify logout security event
      expect(result.current.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'LOGOUT',
          details: expect.objectContaining({
            userId: mockUser.id
          })
        })
      );
    });
  });

  describe('Security Event Tracking', () => {
    it('should maintain security event history', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Simulate multiple security events
      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
        await result.current.verifyMFA(TEST_MFA_CODE);
        await result.current.logout();
      });

      const events = result.current.securityEvents;
      expect(events).toHaveLength(3);
      expect(events.map(e => e.type)).toEqual([
        'LOGIN_SUCCESS',
        'MFA_SUCCESS',
        'LOGOUT'
      ]);
    });

    it('should clear security events', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children, {
          auth: {
            ...mockAuthState,
            securityEvents: [
              { type: 'LOGIN_SUCCESS', timestamp: new Date() }
            ]
          }
        })
      });

      await act(async () => {
        await result.current.clearSecurityEvents();
      });

      expect(result.current.securityEvents).toHaveLength(0);
    });
  });
});