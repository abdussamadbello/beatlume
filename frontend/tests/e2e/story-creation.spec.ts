import { test, expect } from '@playwright/test';

test.describe('Story Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('create new story from dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /new story/i }).click();

    await page.getByRole('textbox', { name: /title/i }).fill('E2E Novel');
    await page.getByRole('textbox', { name: /logline/i }).fill('A test story for E2E.');

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page).toHaveURL(/.*stories\/.*/);
  });

  test('story appears in dashboard list', async ({ page }) => {
    await page.getByRole('button', { name: /new story/i }).click();
    await page.getByRole('textbox', { name: /title/i }).fill('Listed Story');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page).toHaveURL(/.*stories\/.*/);

    await page.goto('/dashboard');

    await expect(page.getByText('Listed Story')).toBeVisible();
  });
});
