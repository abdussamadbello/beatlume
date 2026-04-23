import { test, expect } from '@playwright/test';

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('trigger PDF export', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    await page.getByRole('button', { name: /export/i }).click();
    await page.getByRole('menuitem', { name: /pdf/i }).click();

    await expect(page.getByText(/exporting|preparing|download/i)).toBeVisible({ timeout: 5000 });
  });

  test('export menu shows all formats', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    await page.getByRole('button', { name: /export/i }).click();

    await expect(page.getByText(/pdf/i)).toBeVisible();
    await expect(page.getByText(/docx|word/i)).toBeVisible();
    await expect(page.getByText(/epub/i)).toBeVisible();
  });
});
