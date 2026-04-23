import { test, expect } from '@playwright/test'
import { openFirstStoryFromDashboard } from './helpers'

test.describe('Character Analysis', () => {
  test('add characters to story', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 })
    await openFirstStoryFromDashboard(page)

    const uniqueName = `E2E Quinn ${Date.now()}`
    await page.getByRole('link', { name: /Characters/i }).click()

    await page.getByRole('button', { name: '+ Character' }).click()
    await page.getByPlaceholder('e.g. Mara Holloway').fill(uniqueName)
    await page.getByPlaceholder('Protagonist, Antagonist, Family').fill('Protagonist')
    await page
      .locator('form')
      .filter({ has: page.getByText('New character') })
      .evaluate((el) => (el as HTMLFormElement).requestSubmit())

    await expect(page.getByText(uniqueName).first()).toBeVisible()
  })

  test('trigger AI relationship analysis', async ({ page }) => {
    await openFirstStoryFromDashboard(page)

    await page.getByRole('link', { name: /Graph/i }).click()
    await page.getByText('Suggest Relationships').click()

    await expect(page.getByText('Running...')).toBeVisible({ timeout: 10_000 })
  })
})
