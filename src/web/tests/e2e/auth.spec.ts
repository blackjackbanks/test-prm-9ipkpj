import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mockUser } from '../mocks/data';
import { MFAType, OAuthProvider } from '../../src/types/auth';

/**
 * Authentication E2E Test Suite
 * Tests all authentication flows including email/password, OAuth, MFA, and token management
 * @version 1.0.0
 */

// Test configuration and constants
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_STORAGE_KEY = 'auth_tokens';
const TEST_TIMEOUT = 30000;

// Test selectors
const selectors = {
  emailInput: "[data-testid='email-input']",
  passwordInput: "[data-testid='password-input']",
  loginButton: "[data-testid='login-button']",
  mfaInput: "[data-testid='mfa-input']",
  mfaSubmitButton: "[data-testid='mfa-submit-button']",
  errorMessage: "[data-testid='error-message']",
  googleLoginButton: "[data-testid='google-login-button']",
  microsoftLoginButton: "[data-testid='microsoft-login-button']",
  appleLoginButton: "[data-testid='apple-login-button']",
  logoutButton: "[data-testid='logout-button']",
  dashboardHeader: "[data-testid='dashboard-header']"
};

// Enhanced test setup
async function setupTest(page: Page) {
  // Clear storage and cookies
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);
  
  // Wait for page load
  await page.waitForSelector(selectors.loginButton);
  
  // Initialize accessibility testing
  return new AxeBuilder({ page });
}

test.describe('Authentication E2E Tests', () => {
  let axeBuilder: AxeBuilder;

  test.beforeEach(async ({ page }) => {
    axeBuilder = await setupTest(page);
  });

  test('should login successfully with valid email/password', async ({ page }) => {
    // Fill login form
    await page.fill(selectors.emailInput, mockUser.email);
    await page.fill(selectors.passwordInput, 'validPassword123');
    await page.click(selectors.loginButton);

    // Verify successful login
    await page.waitForSelector(selectors.dashboardHeader);
    expect(await page.isVisible(selectors.dashboardHeader)).toBeTruthy();

    // Check auth tokens
    const tokens = await page.evaluate(() => 
      window.localStorage.getItem(AUTH_STORAGE_KEY)
    );
    expect(tokens).toBeTruthy();

    // Run accessibility check
    const results = await axeBuilder.analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('should handle MFA verification correctly', async ({ page }) => {
    // Login with MFA-enabled account
    await page.fill(selectors.emailInput, mockUser.email);
    await page.fill(selectors.passwordInput, 'validPassword123');
    await page.click(selectors.loginButton);

    // Wait for MFA screen
    await page.waitForSelector(selectors.mfaInput);
    
    // Enter valid MFA code
    await page.fill(selectors.mfaInput, '123456');
    await page.click(selectors.mfaSubmitButton);

    // Verify successful verification
    await page.waitForSelector(selectors.dashboardHeader);
    expect(await page.isVisible(selectors.dashboardHeader)).toBeTruthy();
  });

  test('should handle OAuth authentication with Google', async ({ page }) => {
    await page.click(selectors.googleLoginButton);
    
    // Wait for OAuth redirect
    const googleLoginUrl = await page.url();
    expect(googleLoginUrl).toContain('accounts.google.com');
    
    // Verify state parameter for CSRF protection
    expect(googleLoginUrl).toMatch(/state=[a-zA-Z0-9]+/);
  });

  test('should handle OAuth authentication with Microsoft', async ({ page }) => {
    await page.click(selectors.microsoftLoginButton);
    
    // Wait for OAuth redirect
    const microsoftLoginUrl = await page.url();
    expect(microsoftLoginUrl).toContain('login.microsoftonline.com');
    
    // Verify state parameter for CSRF protection
    expect(microsoftLoginUrl).toMatch(/state=[a-zA-Z0-9]+/);
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.fill(selectors.emailInput, 'invalid@example.com');
    await page.fill(selectors.passwordInput, 'wrongpassword');
    await page.click(selectors.loginButton);

    // Verify error message
    await page.waitForSelector(selectors.errorMessage);
    const errorText = await page.textContent(selectors.errorMessage);
    expect(errorText).toContain('Invalid credentials');
  });

  test('should handle token refresh', async ({ page }) => {
    // Login successfully
    await page.fill(selectors.emailInput, mockUser.email);
    await page.fill(selectors.passwordInput, 'validPassword123');
    await page.click(selectors.loginButton);

    // Wait for initial token
    await page.waitForSelector(selectors.dashboardHeader);
    const initialTokens = await page.evaluate(() => 
      window.localStorage.getItem(AUTH_STORAGE_KEY)
    );

    // Force token refresh
    await page.evaluate(() => {
      const event = new Event('tokenRefresh');
      window.dispatchEvent(event);
    });

    // Verify new token
    const newTokens = await page.evaluate(() => 
      window.localStorage.getItem(AUTH_STORAGE_KEY)
    );
    expect(newTokens).not.toBe(initialTokens);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill(selectors.emailInput, mockUser.email);
    await page.fill(selectors.passwordInput, 'validPassword123');
    await page.click(selectors.loginButton);
    await page.waitForSelector(selectors.dashboardHeader);

    // Perform logout
    await page.click(selectors.logoutButton);

    // Verify redirect to login
    await page.waitForURL(`${BASE_URL}/login`);

    // Verify storage cleanup
    const tokens = await page.evaluate(() => 
      window.localStorage.getItem(AUTH_STORAGE_KEY)
    );
    expect(tokens).toBeNull();
  });

  test('should maintain accessibility standards', async ({ page }) => {
    // Test login form accessibility
    const loginResults = await axeBuilder.analyze();
    expect(loginResults.violations).toHaveLength(0);

    // Login and test authenticated view accessibility
    await page.fill(selectors.emailInput, mockUser.email);
    await page.fill(selectors.passwordInput, 'validPassword123');
    await page.click(selectors.loginButton);
    await page.waitForSelector(selectors.dashboardHeader);

    const dashboardResults = await axeBuilder.analyze();
    expect(dashboardResults.violations).toHaveLength(0);
  });
});