import { test, expect } from '@playwright/test';
import { checkA11y, injectAxe } from '@axe-core/playwright';
import { Template, TemplateCategory } from '../../src/types/template';

/**
 * Test data for template management E2E tests
 * @version 1.0.0
 */
const mockTemplates: Template[] = [
  {
    id: 'test-template-1',
    orgId: 'test-org',
    name: 'Sales Pipeline',
    description: 'Automated sales workflow template',
    category: TemplateCategory.SALES,
    content: { workflow: {} },
    version: '1.0.0',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-template-2',
    orgId: 'test-org',
    name: 'Marketing Campaign',
    description: 'Multi-channel campaign template',
    category: TemplateCategory.MARKETING,
    content: { campaign: {} },
    version: '1.0.0',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const performanceThresholds = {
  pageLoad: 2000,
  templateCreate: 3000,
  searchResponse: 1000
};

const selectors = {
  templateList: "[data-testid='template-list']",
  templateCard: "[data-testid='template-card']",
  createButton: "[data-testid='create-template-button']",
  searchInput: "[data-testid='template-search']",
  categoryFilter: "[data-testid='category-filter']",
  templateEditor: "[data-testid='template-editor']",
  saveButton: "[data-testid='save-template']",
  loadingSpinner: "[data-testid='loading-spinner']",
  errorMessage: "[data-testid='error-message']",
  emptyState: "[data-testid='empty-state']"
};

test.describe('Template Management', () => {
  test.beforeAll(async ({ browser }) => {
    // Global setup
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.setItem('test-mode', 'true');
    });
  });

  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/templates');
    await injectAxe(page);
    await page.waitForSelector(selectors.templateList, { state: 'visible' });
  });

  test('should display template list correctly', async ({ page }) => {
    // Verify template list rendering
    const templateCards = await page.$$(selectors.templateCard);
    expect(templateCards.length).toBeGreaterThan(0);

    // Check template card content
    const firstCard = templateCards[0];
    await expect(firstCard).toContainText(mockTemplates[0].name);
    await expect(firstCard).toContainText(mockTemplates[0].description);
  });

  test('should create new template successfully', async ({ page }) => {
    // Performance measurement start
    const startTime = Date.now();

    // Click create button
    await page.click(selectors.createButton);
    await page.waitForSelector(selectors.templateEditor);

    // Fill template details
    await page.fill('[data-testid="template-name"]', 'New Test Template');
    await page.fill('[data-testid="template-description"]', 'Test description');
    await page.selectOption(selectors.categoryFilter, TemplateCategory.SALES);
    await page.fill('[data-testid="template-content"]', JSON.stringify({ test: true }));

    // Save template
    await page.click(selectors.saveButton);
    await page.waitForSelector(selectors.templateCard);

    // Verify performance
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(performanceThresholds.templateCreate);

    // Verify template creation
    const templateCards = await page.$$(selectors.templateCard);
    const newCard = templateCards[templateCards.length - 1];
    await expect(newCard).toContainText('New Test Template');
  });

  test('should filter templates by category', async ({ page }) => {
    // Select category filter
    await page.selectOption(selectors.categoryFilter, TemplateCategory.SALES);
    await page.waitForResponse(response => response.url().includes('/api/templates'));

    // Verify filtered results
    const templateCards = await page.$$(selectors.templateCard);
    for (const card of templateCards) {
      const category = await card.getAttribute('data-category');
      expect(category).toBe(TemplateCategory.SALES);
    }
  });

  test('should search templates', async ({ page }) => {
    const searchTerm = 'Sales Pipeline';
    
    // Performance measurement start
    const startTime = Date.now();

    // Perform search
    await page.fill(selectors.searchInput, searchTerm);
    await page.waitForResponse(response => response.url().includes('/api/templates/search'));

    // Verify performance
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(performanceThresholds.searchResponse);

    // Verify search results
    const templateCards = await page.$$(selectors.templateCard);
    expect(templateCards.length).toBeGreaterThan(0);
    await expect(templateCards[0]).toContainText(searchTerm);
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/templates', route => route.abort());
    await page.reload();

    // Verify error message
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText('Error loading templates');
  });

  test('should be accessible', async ({ page }) => {
    // Run accessibility checks
    await checkA11y(page, null, {
      axeOptions: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      }
    });
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator(selectors.templateList)).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator(selectors.templateList)).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(selectors.templateList)).toBeVisible();
  });

  test('should meet performance requirements', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now();
    await page.reload();
    await page.waitForSelector(selectors.templateList);
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(performanceThresholds.pageLoad);

    // Verify no memory leaks
    const performanceMetrics = await page.metrics();
    expect(performanceMetrics.JSHeapUsedSize).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test data
    await page.evaluate(() => window.localStorage.clear());
  });
});