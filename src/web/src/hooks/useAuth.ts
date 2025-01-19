/**
 * Custom React hook for managing authentication state and operations.
 * Provides secure authentication flows with MFA support, token refresh,
 * and security event tracking.
 * @version 1.0.0
 */

import { useCallback, useEffect } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import {
  loginThunk,
  logoutThunk,
  refreshTokenThunk,
  selectAuth
} from '../store/slices/authSlice';
import {
  AuthTypes,
  LoginCredentials,
  AuthState,
  OAuthProvider,
  SecurityEvent,
  MFAStatus
} from '../types/auth';

// Constants for security configurations
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Custom hook for managing authentication state and operations
 * with enhanced security features
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const auth = useSelector(selectAuth);

  // Track login attempts for rate limiting
  const [loginAttempts, setLoginAttempts] = useState<Array<number>>([]);

  /**
   * Handles user login with rate limiting and security tracking
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      // Check rate limiting
      const now = Date.now();
      const recentAttempts = loginAttempts.filter(
        timestamp => now - timestamp < LOGIN_ATTEMPT_WINDOW
      );

      if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Dispatch login action
      await dispatch(loginThunk(credentials)).unwrap();
      
      // Update login attempts
      setLoginAttempts([...recentAttempts, now]);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [dispatch, loginAttempts]);

  /**
   * Handles OAuth-based authentication
   */
  const loginWithOAuth = useCallback(async (provider: OAuthProvider) => {
    try {
      // Implementation would handle OAuth flow
      const response = await dispatch(loginWithOAuthThunk({ provider })).unwrap();
      return response;
    } catch (error) {
      console.error('OAuth login failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles MFA verification
   */
  const verifyMFA = useCallback(async (code: string) => {
    try {
      if (!auth.user) {
        throw new Error('No active login session');
      }
      await dispatch(verifyMFAThunk({ code })).unwrap();
    } catch (error) {
      console.error('MFA verification failed:', error);
      throw error;
    }
  }, [dispatch, auth.user]);

  /**
   * Handles secure logout with cleanup
   */
  const logout = useCallback(async () => {
    try {
      await dispatch(logoutThunk()).unwrap();
      // Clear sensitive data from local storage
      localStorage.removeItem('lastLoginAttempt');
      sessionStorage.clear();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles token refresh with retry logic
   */
  const refreshToken = useCallback(async () => {
    try {
      if (!auth.isAuthenticated) return;
      await dispatch(refreshTokenThunk()).unwrap();
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Force logout on critical token errors
      if (error.code === 'TOKEN_INVALID') {
        await logout();
      }
    }
  }, [dispatch, auth.isAuthenticated, logout]);

  /**
   * Clears security event history
   */
  const clearSecurityEvents = useCallback(() => {
    dispatch(clearSecurityEventsThunk());
  }, [dispatch]);

  // Setup automatic token refresh
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const refreshInterval = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [auth.isAuthenticated, refreshToken]);

  // Cleanup login attempts periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setLoginAttempts(prev => 
        prev.filter(timestamp => now - timestamp < LOGIN_ATTEMPT_WINDOW)
      );
    }, LOGIN_ATTEMPT_WINDOW);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loadingState === 'LOADING',
    error: auth.error,
    mfaStatus: {
      required: auth.mfaRequired,
      verified: auth.mfaVerified
    },
    securityEvents: auth.securityEvents,
    login,
    loginWithOAuth,
    verifyMFA,
    logout,
    refreshToken,
    clearSecurityEvents
  };
};

export default useAuth;