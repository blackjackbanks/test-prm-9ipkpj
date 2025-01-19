import { test, expect, Page } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';
import { Message, MessageType, MessageStatus } from '../../src/types/chat';
import { LoadingState } from '../../src/types/common';

// Test fixtures and constants
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  preferences: { theme: 'light', notifications: true }
};

const TEST_MESSAGE: Message = {
  id: 'msg-123',
  type: MessageType.USER,
  content: 'Test message content',
  status: MessageStatus.SENT,
  attachments: [],
  createdAt: new Date('2023-08-17T10:00:00Z'),
  updatedAt: new Date('2023-08-17T10:00:00Z'),
  version: 1
};

// Selectors
const SELECTORS = {
  chatContainer: '[data-testid="chat-container"]',
  contextPanel: '[data-testid="context-panel"]',
  messageList: '[data-testid="message-list"]',
  messageInput: '[data-testid="message-input"]',
  sendButton: '[data-testid="send-button"]',
  attachmentButton: '[data-testid="attachment-button"]',
  loadingIndicator: '[data-testid="loading-indicator"]',
  errorMessage: '[data-testid="error-message"]',
  retryButton: '[data-testid="retry-button"]'
};

let page: Page;

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ browser }) => {
    // Create new context and page for each test
    const context = await browser.newContext();
    page = await context.newPage();

    // Setup network interception
    await page.route('**/api/chat/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: [] })
      });
    });

    // Mock WebSocket connection
    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        onopen: () => void = () => {};
        onmessage: (event: MessageEvent) => void = () => {};
        send: (data: string) => void = () => {};
        close: () => void = () => {};
      };
    });

    // Navigate to chat page and wait for load
    await page.goto('/chat');
    await page.waitForSelector(SELECTORS.chatContainer);

    // Inject axe-core for accessibility testing
    await injectAxe(page);
  });

  test('should display all chat interface components', async () => {
    // Verify core components visibility
    await expect(page.locator(SELECTORS.contextPanel)).toBeVisible();
    await expect(page.locator(SELECTORS.messageList)).toBeVisible();
    await expect(page.locator(SELECTORS.messageInput)).toBeVisible();
    await expect(page.locator(SELECTORS.sendButton)).toBeVisible();
    await expect(page.locator(SELECTORS.attachmentButton)).toBeVisible();

    // Verify accessibility compliance
    const violations = await getViolations(page);
    expect(violations.length).toBe(0);
  });

  test('should handle real-time messaging', async () => {
    // Type and send message
    await page.fill(SELECTORS.messageInput, TEST_MESSAGE.content);
    await page.click(SELECTORS.sendButton);

    // Verify message appears in list
    const messageElement = page.locator(`[data-testid="message-${TEST_MESSAGE.id}"]`);
    await expect(messageElement).toBeVisible();
    await expect(messageElement).toContainText(TEST_MESSAGE.content);

    // Verify message status updates
    await expect(messageElement.locator('[data-testid="message-status"]'))
      .toHaveAttribute('data-status', MessageStatus.SENT);
  });

  test('should handle file attachments', async () => {
    // Setup file input handling
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content')
    });

    // Verify attachment preview
    await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="attachment-name"]')).toContainText('test.txt');
  });

  test('should maintain context awareness', async () => {
    // Verify context panel information
    await expect(page.locator('[data-testid="project-context"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-context"]')).toBeVisible();
    
    // Verify context updates with navigation
    await page.click('[data-testid="switch-project"]');
    await expect(page.locator('[data-testid="project-context"]'))
      .toContainText('New Project Context');
  });

  test('should handle error states gracefully', async () => {
    // Mock network error
    await page.route('**/api/chat/send', route => {
      route.fulfill({ status: 500 });
    });

    // Attempt to send message
    await page.fill(SELECTORS.messageInput, 'Error test message');
    await page.click(SELECTORS.sendButton);

    // Verify error handling
    await expect(page.locator(SELECTORS.errorMessage)).toBeVisible();
    await expect(page.locator(SELECTORS.retryButton)).toBeVisible();
  });

  test('should meet performance criteria', async () => {
    // Start performance measurement
    const startTime = Date.now();

    // Send test message
    await page.fill(SELECTORS.messageInput, 'Performance test message');
    await page.click(SELECTORS.sendButton);

    // Wait for AI response
    await page.waitForSelector('[data-testid="ai-response"]');

    // Verify response time is under 3 seconds
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(3000);
  });

  test('should support keyboard navigation', async () => {
    // Test keyboard shortcuts
    await page.keyboard.press('Tab');
    await expect(page.locator(SELECTORS.messageInput)).toBeFocused();

    await page.keyboard.press('Control+Enter');
    await expect(page.locator(`[data-testid="message-${TEST_MESSAGE.id}"]`)).toBeVisible();

    // Test accessibility navigation
    await checkA11y(page);
  });

  test('should handle offline/reconnection scenarios', async () => {
    // Simulate offline state
    await page.setOffline(true);
    
    // Attempt to send message
    await page.fill(SELECTORS.messageInput, 'Offline test message');
    await page.click(SELECTORS.sendButton);

    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Simulate reconnection
    await page.setOffline(false);

    // Verify message gets sent after reconnection
    await expect(page.locator('[data-testid="message-status"]'))
      .toHaveAttribute('data-status', MessageStatus.SENT);
  });
});