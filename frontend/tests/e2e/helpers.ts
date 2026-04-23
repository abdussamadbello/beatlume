import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Opens the first story on the dashboard (any title). Story cards use an h3 for the title. */
export async function openFirstStoryFromDashboard(page: Page) {
  await page.goto('/dashboard')
  await page.getByRole('heading', { level: 3 }).first().click()
  await expect(page).toHaveURL(/\/stories\//)
}
