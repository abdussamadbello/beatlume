import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);

    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/.*login/);
  });
});
