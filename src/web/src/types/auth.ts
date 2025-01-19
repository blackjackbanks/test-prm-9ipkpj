/**
 * Authentication-related TypeScript type definitions and interfaces.
 * Provides type safety for authentication flows, OAuth providers, and MFA.
 * @version 1.0.0
 */

import { BaseModel, LoadingState } from './common';

/**
 * User model interface extending BaseModel with authentication-specific fields
 */
export interface User extends BaseModel {
  /** User's email address */
  email: string;
  /** User's full name */
  name: string;
  /** User preferences as key-value pairs */
  preferences: Record<string, unknown>;
  /** Whether MFA is enabled for the user */
  mfaEnabled: boolean;
  /** Type of MFA if enabled */
  mfaType: MFAType | null;
}

/**
 * Login credentials interface for email/password authentication
 */
export interface LoginCredentials {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
}

/**
 * Supported Multi-Factor Authentication types
 */
export enum MFAType {
  /** Time-based One-Time Password */
  TOTP = 'TOTP',
  /** SMS-based verification code */
  SMS = 'SMS'
}

/**
 * MFA verification credentials interface
 */
export interface MFACredentials {
  /** Type of MFA being verified */
  type: MFAType;
  /** Verification code provided by user */
  code: string;
  /** Temporary token from initial authentication */
  token: string;
}

/**
 * Authentication error interface for standardized error handling
 */
export interface AuthError {
  /** Error code for machine processing */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error context */
  details?: Record<string, unknown>;
}

/**
 * Authentication state interface for Redux store
 */
export interface AuthState {
  /** Currently authenticated user */
  user: User | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** JWT access token */
  accessToken: string | null;
  /** JWT refresh token */
  refreshToken: string | null;
  /** Current loading state */
  loadingState: LoadingState;
  /** Authentication error if any */
  error: AuthError | null;
}

/**
 * Token validation response interface
 */
export interface TokenValidation {
  /** Whether token is valid */
  isValid: boolean;
  /** Token expiration timestamp */
  expiresAt: Date;
  /** Token scopes/permissions */
  scope: string[];
}

/**
 * Supported OAuth providers
 */
export enum OAuthProvider {
  /** Google OAuth */
  GOOGLE = 'GOOGLE',
  /** Microsoft OAuth */
  MICROSOFT = 'MICROSOFT',
  /** Apple OAuth */
  APPLE = 'APPLE'
}

/**
 * OAuth provider configuration interface
 */
export interface OAuthConfig {
  /** OAuth provider type */
  provider: OAuthProvider;
  /** OAuth client ID */
  clientId: string;
  /** Required OAuth scopes */
  scope: string[];
  /** OAuth redirect URI */
  redirectUri: string;
}

/**
 * OAuth response interface
 */
export interface OAuthResponse {
  /** OAuth provider */
  provider: OAuthProvider;
  /** Authorization code */
  code: string;
  /** State parameter for CSRF protection */
  state: string;
}

/**
 * Password reset request interface
 */
export interface PasswordResetRequest {
  /** User's email address */
  email: string;
}

/**
 * Password reset confirmation interface
 */
export interface PasswordResetConfirmation {
  /** Reset token from email */
  token: string;
  /** New password */
  newPassword: string;
}