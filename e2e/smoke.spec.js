const { test, expect } = require('@playwright/test');

test.describe('CivJS smoke', () => {
  test('loads app shell and default map editor UI', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.locator('#main-toolbar')).toBeVisible();
    await expect(page.locator('button[data-editor-mode="MAP_EDITOR"]')).toBeVisible();
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('switches between major editor modes', async ({ page }) => {
    await page.goto('/');

    await page.click('button[data-editor-mode="ECONOMY_EDITOR"]');
    await expect(page.locator('#economy-editor-ui')).toBeVisible();

    await page.click('button[data-editor-mode="FACTORY_OVERVIEW"]');
    await expect(page.locator('#factory-overview-ui')).toBeVisible();

    await page.click('button[data-editor-mode="TEST_EDITOR"]');
    await expect(page.locator('#test-editor-ui')).toBeVisible();
  });
});
