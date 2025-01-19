/**
 * Redux slice for managing authentication state with enhanced security features
 * Includes support for MFA, token rotation, and security event tracking
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { 
  AuthState, 
  User, 
  MFACredentials, 
  AuthError, 
  LoadingState,
  TokenValidation,
  OAuthProvider,
  OAuthResponse
} from '../../types/auth';

// Security-related types
enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  MFA_SUCCESS = 'MFA_SUCCESS',
  MFA_FAILURE = 'MFA_FAILURE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  LOGOUT = 'LOGOUT',
  SECURITY_UPDATE = 'SECURITY_UPDATE'
}

interface SecurityEvent {
  type: SecurityEventType;
  timestamp: Date;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Initial state with enhanced security features
const initialState: AuthState = {
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

// Async thunks for authentication actions
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      // Implementation would call authentication API
      const response = await authApi.login(credentials);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

export const verifyMFA = createAsyncThunk(
  'auth/verifyMFA',
  async (credentials: MFACredentials, { rejectWithValue, getState }) => {
    try {
      const response = await authApi.verifyMFA(credentials);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const response = await authApi.refreshToken(state.auth.refreshToken);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

export const updateSecurityPreferences = createAsyncThunk(
  'auth/updateSecurity',
  async (preferences: { mfaEnabled: boolean; mfaType: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.updateSecurityPreferences(preferences);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  }
);

// Auth slice with enhanced security features
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      const logoutEvent: SecurityEvent = {
        type: SecurityEventType.LOGOUT,
        timestamp: new Date(),
        details: { userId: state.user?.id }
      };
      
      // Reset state but preserve security events
      const securityEvents = [...state.securityEvents, logoutEvent];
      Object.assign(state, { ...initialState, securityEvents });
    },
    
    recordSecurityEvent: (state, action: PayloadAction<SecurityEvent>) => {
      state.securityEvents.push(action.payload);
    },
    
    clearSecurityEvents: (state) => {
      state.securityEvents = [];
    },
    
    resetFailedAttempts: (state) => {
      state.failedLoginAttempts = 0;
    }
  },
  extraReducers: (builder) => {
    // Login handling
    builder.addCase(login.pending, (state) => {
      state.loadingState = LoadingState.LOADING;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loadingState = LoadingState.SUCCESS;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.tokenExpiresAt = action.payload.expiresAt;
      state.mfaRequired = action.payload.mfaRequired;
      state.isAuthenticated = !action.payload.mfaRequired;
      state.lastLoginAt = new Date();
      state.failedLoginAttempts = 0;
      
      state.securityEvents.push({
        type: SecurityEventType.LOGIN_SUCCESS,
        timestamp: new Date(),
        details: {
          userId: action.payload.user.id,
          mfaRequired: action.payload.mfaRequired
        }
      });
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loadingState = LoadingState.ERROR;
      state.error = action.payload as AuthError;
      state.failedLoginAttempts += 1;
      
      state.securityEvents.push({
        type: SecurityEventType.LOGIN_FAILURE,
        timestamp: new Date(),
        details: {
          reason: action.payload,
          attemptCount: state.failedLoginAttempts
        }
      });
    });

    // MFA verification handling
    builder.addCase(verifyMFA.pending, (state) => {
      state.loadingState = LoadingState.LOADING;
    });
    builder.addCase(verifyMFA.fulfilled, (state, action) => {
      state.loadingState = LoadingState.SUCCESS;
      state.mfaVerified = true;
      state.isAuthenticated = true;
      state.accessToken = action.payload.accessToken;
      
      state.securityEvents.push({
        type: SecurityEventType.MFA_SUCCESS,
        timestamp: new Date(),
        details: {
          userId: state.user?.id,
          method: action.payload.mfaType
        }
      });
    });
    builder.addCase(verifyMFA.rejected, (state, action) => {
      state.loadingState = LoadingState.ERROR;
      state.error = action.payload as AuthError;
      
      state.securityEvents.push({
        type: SecurityEventType.MFA_FAILURE,
        timestamp: new Date(),
        details: {
          userId: state.user?.id,
          reason: action.payload
        }
      });
    });

    // Token refresh handling
    builder.addCase(refreshToken.fulfilled, (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.tokenExpiresAt = action.payload.expiresAt;
      
      state.securityEvents.push({
        type: SecurityEventType.TOKEN_REFRESH,
        timestamp: new Date(),
        details: {
          userId: state.user?.id,
          expiresAt: action.payload.expiresAt
        }
      });
    });
  }
});

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectMFAStatus = (state: RootState) => ({
  required: state.auth.mfaRequired,
  verified: state.auth.mfaVerified
});
export const selectSecurityEvents = (state: RootState) => state.auth.securityEvents;
export const selectAuthLoadingState = (state: RootState) => state.auth.loadingState;
export const selectAuthError = (state: RootState) => state.auth.error;

// Export actions and reducer
export const { 
  logout, 
  recordSecurityEvent, 
  clearSecurityEvents, 
  resetFailedAttempts 
} = authSlice.actions;

export default authSlice.reducer;