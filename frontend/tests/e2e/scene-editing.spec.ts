import { test, expect } from '@playwright/test';

test.describe('Scene Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('add scene to story', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story|My Novel/i }).first().click();
    await expect(page).toHaveURL(/.*stories\/.*/);

    await page.getByRole('button', { name: /add scene|new scene/i }).click();

    await page.getByRole('textbox', { name: /title/i }).fill('Test Scene');

    await page.getByRole('button', { name: /save|create/i }).click();

    await expect(page.getByText('Test Scene')).toBeVisible();
  });

  test('edit scene content', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    await page.getByRole('link', { name: /scene/i }).first().click();

    const editor = page.getByRole('textbox').first();
    await editor.fill('This is edited scene content for E2E testing.');

    await page.keyboard.press('Control+s');

    await page.reload();
    await expect(editor).toHaveValue(/edited scene content/);
  });
});
