import { test, expect } from '@playwright/test'
import { openFirstStoryFromDashboard } from './helpers'

test.describe('Export', () => {
  test('trigger PDF export', async ({ page }) => {
    await openFirstStoryFromDashboard(page)

    await page.getByRole('link', { name: /^Export$/i }).click()
    await expect(page).toHaveURL(/\/export/)

    await page.getByRole('radio', { name: /^PDF$/i }).check()
    await page
      .getByRole('button', { name: /Export as PDF|Exporting/i })
      .click()

    await expect(
      page.getByText(/Exporting\.\.\.|Export started|Export failed/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('export page shows all formats', async ({ page }) => {
    await openFirstStoryFromDashboard(page)
    await page.getByRole('link', { name: /^Export$/i }).click()

    await expect(page.getByRole('radio', { name: /^PDF$/i })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^DOCX$/i })).toBeVisible()
    await expect(page.getByRole('radio', { name: /ePub/i })).toBeVisible()
  })
})
