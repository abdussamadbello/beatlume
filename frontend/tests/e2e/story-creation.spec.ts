import { test, expect } from '@playwright/test'

test.describe('Story Creation', () => {
  test('create new story from setup wizard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'New Story' }).click()
    await expect(page).toHaveURL(/\/setup/)

    await page.getByPlaceholder('A Stranger in the Orchard').fill('E2E Novel')
    await page
      .getByPlaceholder(
        "A widow returning to her family's failing orchard discovers the stranger who appears at harvest may be the one who buried her sister."
      )
      .fill('A test story for E2E.')

    await page.getByRole('button', { name: /Continue.*Structure/i }).click()
    await page.getByRole('button', { name: /Continue.*Characters/i }).click()
    await page.getByRole('button', { name: /Continue.*Scaffold/i }).click()
    await page.getByRole('button', { name: /Create Story/ }).click()

    await expect(page).toHaveURL(/\/stories\/.*/, { timeout: 30_000 })
  })

  test('new story appears on dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'New Story' }).click()
    await expect(page).toHaveURL(/\/setup/)

    const unique = `Listed Story E2E ${Date.now()}`
    await page.getByPlaceholder('A Stranger in the Orchard').fill(unique)
    await page.getByRole('button', { name: /Continue.*Structure/i }).click()
    await page.getByRole('button', { name: /Continue.*Characters/i }).click()
    await page.getByRole('button', { name: /Continue.*Scaffold/i }).click()
    await page.getByRole('button', { name: /Create Story/ }).click()
    await expect(page).toHaveURL(/\/stories\/.*/, { timeout: 30_000 })

    await page.goto('/dashboard')
    await expect(page.getByText(unique)).toBeVisible()
  })

  test('overview shows generate structure callout for a new story', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'New Story' }).click()
    const unique = `CTA Story ${Date.now()}`
    await page.getByPlaceholder('A Stranger in the Orchard').fill(unique)
    await page
      .getByPlaceholder(
        "A widow returning to her family's failing orchard discovers the stranger who appears at harvest may be the one who buried her sister."
      )
      .fill('Overview CTA e2e.')
    await page.getByRole('button', { name: /Continue.*Structure/i }).click()
    await page.getByRole('button', { name: /Continue.*Characters/i }).click()
    await page.getByRole('button', { name: /Continue.*Scaffold/i }).click()
    await page.getByRole('button', { name: 'Create Story' }).click()
    await expect(page).toHaveURL(/\/stories\/.*/, { timeout: 30_000 })
    await expect(page.getByText('Start with a storyline')).toBeVisible()
    await expect(page.getByRole('button', { name: /Generate story structure/i })).toBeVisible()
  })
})
