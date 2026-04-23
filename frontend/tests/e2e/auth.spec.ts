import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);

    await page.getByPlaceholder('you@example.com').fill('elena@beatlume.io');
    await page.getByPlaceholder('Enter your password').fill('beatlume123');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10_000 });
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/.*login/);
  });
});
