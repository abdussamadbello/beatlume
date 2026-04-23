import { test, expect } from '@playwright/test'
import { openFirstStoryFromDashboard } from './helpers'

test.describe('Scene Editing', () => {
  test('add scene to story', async ({ page }) => {
    await openFirstStoryFromDashboard(page)

    await page.getByRole('link', { name: /Scene Board/i }).click()

    await page.getByRole('button', { name: /\+ Scene/ }).click()

    await expect(page).toHaveURL(/\/stories\/[^/]+\/scenes\/[^/]+/)
    await expect(page.getByText('Untitled scene').first()).toBeVisible()
  })

  test('edit scene content', async ({ page }) => {
    await openFirstStoryFromDashboard(page)

    await page.getByRole('link', { name: /Draft/i }).click()
    // Left rail: ensure first scene is active (debounced save needs active scene + hydrated draft)
    await page.getByText(/S01/).first().click()

    const text = 'This is edited scene content for E2E testing.'
    const editor = page.locator('textarea').first()
    await editor.fill(text)
    // Debounced save in Draft (~800ms); allow margin so PUT completes.
    await page.waitForTimeout(3000)

    await page.reload()
    await page.getByRole('link', { name: /Draft/i }).click()
    await page.getByText(/S01/).first().click()

    await expect(page.locator('textarea').first()).toHaveValue(/edited scene content/, {
      timeout: 15_000,
    })
  })
})
