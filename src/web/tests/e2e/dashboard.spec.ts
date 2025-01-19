import { test, expect, type Page } from '@playwright/test'; // v1.35.0

// Test configuration and constants
const PERFORMANCE_THRESHOLDS = {
  initialLoad: 3000, // 3s max initial load time
  widgetLoad: 1000, // 1s max per widget load
  dataRefresh: 500, // 500ms max data refresh time
  ttfb: 800, // 800ms max time to first byte
  fcp: 1500 // 1.5s max first contentful paint
};

const VIEWPORT_SIZES = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 }
};

const SELECTORS = {
  dashboard: {
    container: "[data-testid='dashboard-container']",
    header: "[data-testid='dashboard-header']",
    title: "[data-testid='dashboard-title']",
    grid: "[data-testid='dashboard-grid']",
    loadingStates: {
      initial: "[data-testid='dashboard-loading']",
      widgets: "[data-testid='widget-loading']",
      data: "[data-testid='data-loading']"
    },
    widgets: {
      metrics: "[data-testid='metrics-widget']",
      tasks: "[data-testid='tasks-widget']",
      performance: "[data-testid='performance-widget']"
    }
  }
};

// Mock data for testing
const MOCK_METRICS = {
  tasksComplete: {
    value: 85,
    change: 15,
    trend: Array.from({ length: 7 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 86400000),
      value: 80 + Math.floor(Math.random() * 10)
    }))
  }
};

test.describe('Dashboard Core Functionality', () => {
  let startTime: number;
  let performanceMetrics: { [key: string]: number } = {};

  test.beforeEach(async ({ page }) => {
    startTime = Date.now();

    // Setup performance monitoring
    await page.route('**/*', route => {
      performanceMetrics.ttfb = Date.now() - startTime;
      return route.continue();
    });

    // Clear state and navigate
    await page.context().clearCookies();
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Wait for critical elements
    await page.waitForSelector(SELECTORS.dashboard.container, { state: 'visible' });
    performanceMetrics.fcp = Date.now() - startTime;

    // Setup API mocks
    await page.route('/api/metrics', route => {
      return route.fulfill({
        status: 200,
        body: JSON.stringify(MOCK_METRICS)
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Capture final performance metrics
    performanceMetrics.totalDuration = Date.now() - startTime;

    // Store test artifacts
    await page.screenshot({ 
      path: `./test-results/dashboard-${Date.now()}.png`,
      fullPage: true 
    });

    // Clear test state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should load dashboard within performance thresholds', async ({ page }) => {
    // Verify initial loading state
    await expect(page.locator(SELECTORS.dashboard.loadingStates.initial))
      .toBeVisible();

    // Wait for and verify critical content
    await expect(page.locator(SELECTORS.dashboard.title))
      .toBeVisible();
    await expect(page.locator(SELECTORS.dashboard.grid))
      .toBeVisible();

    // Verify performance metrics
    expect(performanceMetrics.ttfb).toBeLessThan(PERFORMANCE_THRESHOLDS.ttfb);
    expect(performanceMetrics.fcp).toBeLessThan(PERFORMANCE_THRESHOLDS.fcp);
    expect(performanceMetrics.totalDuration)
      .toBeLessThan(PERFORMANCE_THRESHOLDS.initialLoad);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('/api/metrics', route => route.abort('failed'));
    
    // Verify error state
    await expect(page.locator('[data-testid="error-state"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]'))
      .toBeVisible();

    // Test retry functionality
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator(SELECTORS.dashboard.widgets.metrics))
      .toBeVisible();
  });

  test('should meet accessibility standards', async ({ page }) => {
    // Run accessibility audit
    const violations = await page.evaluate(async () => {
      // @ts-ignore - axe-core would be injected in actual implementation
      const results = await window.axe.run();
      return results.violations;
    });

    expect(violations).toHaveLength(0);
  });

  test('should persist user customizations', async ({ page }) => {
    // Customize widget layout
    await page.dragAndDrop(
      '[data-testid="metrics-widget"]',
      '[data-testid="dashboard-grid"] > :nth-child(2)'
    );

    // Refresh page
    await page.reload();

    // Verify layout persistence
    const widgetPosition = await page.evaluate(() => {
      const widget = document.querySelector('[data-testid="metrics-widget"]');
      return widget?.parentElement?.getAttribute('data-grid-position');
    });

    expect(widgetPosition).toBe('1');
  });

  test('should handle data refresh correctly', async ({ page }) => {
    // Monitor network requests
    const refreshPromise = page.waitForResponse('/api/metrics');

    // Trigger refresh
    await page.click('[data-testid="refresh-button"]');

    // Verify refresh behavior
    const response = await refreshPromise;
    expect(response.status()).toBe(200);

    // Check loading states
    await expect(page.locator(SELECTORS.dashboard.loadingStates.data))
      .toBeVisible();
    await expect(page.locator(SELECTORS.dashboard.loadingStates.data))
      .toBeHidden();

    // Verify data update
    await expect(page.locator(SELECTORS.dashboard.widgets.metrics))
      .toContainText(MOCK_METRICS.tasksComplete.value.toString());
  });

  test('should maintain performance under load', async ({ page }) => {
    // Simulate rapid interactions
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="refresh-button"]');
      await page.waitForTimeout(100);
    }

    // Verify UI responsiveness
    const finalResponseTime = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="refresh-button"]');
      const start = performance.now();
      button?.click();
      return performance.now() - start;
    });

    expect(finalResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.dataRefresh);
  });
});