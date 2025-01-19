/**
 * Enhanced authentication service module implementing secure user authentication,
 * token management, and OAuth provider integration with advanced security features.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.4.0
import CryptoJS from 'crypto-js'; // v4.1.1
import { generateChallenge } from 'pkce-challenge'; // v3.0.0

import { LoginCredentials, AuthResponse, OAuthProvider } from '../types/auth';
import { API_ENDPOINTS } from '../constants/api';

// Constants for token management and security
const TOKEN_STORAGE_KEY = 'auth_tokens';
const OAUTH_STATE_KEY = 'oauth_state';
const MAX_LOGIN_ATTEMPTS = 3;
const TOKEN_REFRESH_BUFFER = 300000; // 5 minutes
const PKCE_LENGTH = 128;

// Encryption key from environment variable
const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY || '';

/**
 * Enhanced login function with rate limiting and security measures
 * @param credentials User login credentials
 * @returns Promise resolving to AuthResponse
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    // Validate credentials
    if (!credentials.email || !credentials.password) {
      throw new Error('Invalid credentials');
    }

    // Check rate limiting from localStorage
    const attempts = JSON.parse(localStorage.getItem('login_attempts') || '{"count": 0, "timestamp": 0}');
    if (attempts.count >= MAX_LOGIN_ATTEMPTS && 
        Date.now() - attempts.timestamp < 900000) { // 15 minutes lockout
      throw new Error('Too many login attempts. Please try again later.');
    }

    // Generate CSRF token
    const csrfToken = CryptoJS.lib.WordArray.random(16).toString();
    
    // Make login request with CSRF token
    const response = await axios.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );

    // Validate response
    if (!response.data.accessToken || !response.data.refreshToken) {
      throw new Error('Invalid server response');
    }

    // Encrypt tokens before storage
    const encryptedTokens = encryptTokens({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken
    });

    // Store encrypted tokens in secure storage
    localStorage.setItem(TOKEN_STORAGE_KEY, encryptedTokens);

    // Reset login attempts
    localStorage.setItem('login_attempts', JSON.stringify({ count: 0, timestamp: Date.now() }));

    // Initialize automatic token refresh
    initializeTokenRefresh(response.data.accessToken);

    return response.data;

  } catch (error) {
    // Update login attempts
    const attempts = JSON.parse(localStorage.getItem('login_attempts') || '{"count": 0, "timestamp": 0}');
    localStorage.setItem('login_attempts', JSON.stringify({
      count: attempts.count + 1,
      timestamp: Date.now()
    }));

    throw error;
  }
}

/**
 * Enhanced OAuth provider authentication with PKCE
 * @param provider OAuth provider (Google, Microsoft, Apple)
 */
export async function loginWithProvider(provider: OAuthProvider): Promise<void> {
  try {
    // Generate PKCE verifier and challenge
    const verifier = CryptoJS.lib.WordArray.random(PKCE_LENGTH).toString();
    const challenge = await generateChallenge(verifier);

    // Generate secure state token with timestamp
    const state = CryptoJS.lib.WordArray.random(32).toString() + 
                 Date.now().toString();

    // Store PKCE verifier and state securely
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify({ verifier, state }),
      ENCRYPTION_KEY
    ).toString();
    sessionStorage.setItem(OAUTH_STATE_KEY, encryptedData);

    // Configure provider-specific parameters
    const params = new URLSearchParams({
      client_id: process.env[`VITE_${provider}_CLIENT_ID`] || '',
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: 'code',
      scope: getProviderScope(provider),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    // Redirect to provider's auth URL
    window.location.href = getProviderAuthUrl(provider) + '?' + params.toString();

  } catch (error) {
    throw new Error(`OAuth initialization failed: ${error}`);
  }
}

/**
 * Handle OAuth callback with state validation
 * @param code Authorization code from OAuth provider
 * @param state State parameter for validation
 */
export async function handleOAuthCallback(
  code: string,
  state: string
): Promise<AuthResponse> {
  try {
    // Retrieve and decrypt stored OAuth data
    const encryptedData = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!encryptedData) {
      throw new Error('Invalid OAuth session');
    }

    const decryptedData = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY)
      .toString(CryptoJS.enc.Utf8);
    const { verifier, state: storedState } = JSON.parse(decryptedData);

    // Validate state parameter
    if (state !== storedState) {
      throw new Error('Invalid OAuth state');
    }

    // Exchange code for tokens
    const response = await axios.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      {
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code'
      },
      { withCredentials: true }
    );

    // Store tokens and initialize refresh
    const encryptedTokens = encryptTokens({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, encryptedTokens);
    initializeTokenRefresh(response.data.accessToken);

    // Clean up OAuth session data
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    return response.data;

  } catch (error) {
    throw new Error(`OAuth callback failed: ${error}`);
  }
}

/**
 * Automatic token refresh with rotation
 */
export async function refreshToken(): Promise<void> {
  try {
    // Decrypt stored tokens
    const encryptedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!encryptedTokens) {
      throw new Error('No refresh token available');
    }

    const { refreshToken } = decryptTokens(encryptedTokens);

    // Request new tokens
    const response = await axios.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refreshToken },
      { withCredentials: true }
    );

    // Store new encrypted tokens
    const newEncryptedTokens = encryptTokens({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, newEncryptedTokens);

    // Initialize new refresh timer
    initializeTokenRefresh(response.data.accessToken);

  } catch (error) {
    // Force logout on refresh failure
    await logout();
    throw new Error('Token refresh failed');
  }
}

/**
 * Secure logout with token revocation
 */
export async function logout(): Promise<void> {
  try {
    // Revoke tokens on server
    const encryptedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (encryptedTokens) {
      const { refreshToken } = decryptTokens(encryptedTokens);
      await axios.post(
        API_ENDPOINTS.AUTH.LOGOUT,
        { refreshToken },
        { withCredentials: true }
      );
    }

    // Clear local storage and cookies
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('login_attempts');
    document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Helper functions

/**
 * Initialize automatic token refresh
 */
function initializeTokenRefresh(token: string): void {
  const payload = JSON.parse(atob(token.split('.')[1]));
  const expiresIn = payload.exp * 1000 - Date.now() - TOKEN_REFRESH_BUFFER;
  
  setTimeout(() => {
    refreshToken().catch(console.error);
  }, Math.max(0, expiresIn));
}

/**
 * Encrypt tokens for secure storage
 */
function encryptTokens(tokens: { 
  accessToken: string;
  refreshToken: string;
}): string {
  return CryptoJS.AES.encrypt(
    JSON.stringify(tokens),
    ENCRYPTION_KEY
  ).toString();
}

/**
 * Decrypt tokens from secure storage
 */
function decryptTokens(encryptedTokens: string): {
  accessToken: string;
  refreshToken: string;
} {
  const decrypted = CryptoJS.AES.decrypt(encryptedTokens, ENCRYPTION_KEY)
    .toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted);
}

/**
 * Get OAuth provider-specific scope
 */
function getProviderScope(provider: OAuthProvider): string {
  const scopes = {
    [OAuthProvider.GOOGLE]: 'openid profile email',
    [OAuthProvider.MICROSOFT]: 'openid profile email User.Read',
    [OAuthProvider.APPLE]: 'name email'
  };
  return scopes[provider];
}

/**
 * Get OAuth provider authorization URL
 */
function getProviderAuthUrl(provider: OAuthProvider): string {
  const urls = {
    [OAuthProvider.GOOGLE]: 'https://accounts.google.com/o/oauth2/v2/auth',
    [OAuthProvider.MICROSOFT]: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    [OAuthProvider.APPLE]: 'https://appleid.apple.com/auth/authorize'
  };
  return urls[provider];
}