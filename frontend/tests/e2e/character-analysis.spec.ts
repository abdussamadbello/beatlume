import { test, expect } from '@playwright/test';

test.describe('Character Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('add characters to story', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    await page.getByRole('link', { name: /character/i }).click();

    await page.getByRole('button', { name: /add character|new character/i }).click();
    await page.getByRole('textbox', { name: /name/i }).fill('Iris');
    await page.getByRole('textbox', { name: /role/i }).fill('Protagonist');
    await page.getByRole('button', { name: /save|create/i }).click();

    await expect(page.getByText('Iris')).toBeVisible();
  });

  test('trigger AI relationship analysis', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();
    await page.getByRole('link', { name: /character/i }).click();

    await page.getByRole('button', { name: /analyze|AI|relationship/i }).click();

    await expect(page.getByText(/analyzing|processing|running/i)).toBeVisible({ timeout: 5000 });
  });
});
