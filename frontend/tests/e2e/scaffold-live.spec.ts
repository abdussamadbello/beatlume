import { test, expect } from '@playwright/test'

/**
 * Full stack: Vite → FastAPI → Celery (ai_heavy) → OpenRouter.
 *
 * Prereqs (separate terminals or process manager):
 *   - PostgreSQL with schema + seed (`make setup` or `make seed`)
 *   - Redis
 *   - `make dev-backend` (or uvicorn on :8000)
 *   - `make celery-heavy` (scaffold task queue)
 *   - `backend/.env` with OPENROUTER_API_KEY and valid AI_MODEL_* slugs
 *
 * Run: `LIVE_AI_E2E=1 npx playwright test scaffold-live` from `frontend/`
 * Or: `make test-e2e-live` from repo root
 */
test.describe('AI scaffold (live stack)', () => {
  test('create story, generate structure, see scenes in overview', async ({ page }) => {
    test.skip(
      !process.env.LIVE_AI_E2E,
      'Set LIVE_AI_E2E=1; start backend :8000, Redis, and `make celery-heavy`',
    )
    // Celery may retry scaffold on bad JSON (180s backoff) + two LLM calls; allow >4 min.
    test.setTimeout(400_000)

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'New Story' }).click()
    await expect(page).toHaveURL(/\/setup/)

    const title = `Live E2E ${Date.now()}`
    await page.getByPlaceholder('A Stranger in the Orchard').fill(title)
    await page
      .getByPlaceholder(
        "A widow returning to her family's failing orchard discovers the stranger who appears at harvest may be the one who buried her sister.",
      )
      .fill('An end-to-end test story: a lighthouse keeper finds old letters in the wall during a storm.')

    await page.getByRole('button', { name: /Continue.*Structure/i }).click()
    await page.getByRole('button', { name: /Continue.*Characters/i }).click()
    await page.getByRole('button', { name: /Continue.*Scaffold/i }).click()
    await page.getByRole('button', { name: 'Create Story' }).click()
    await expect(page).toHaveURL(/\/stories\/.*/, { timeout: 30_000 })

    const scaffoldBtn = page.getByRole('button', { name: /Generate story structure/i })
    await expect(scaffoldBtn).toBeVisible()
    await scaffoldBtn.click()

    await expect(page.getByText('Scaffolding…')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Next: draft the manuscript')).toBeVisible({ timeout: 360_000 })
    await expect(page.getByText(/You have \d+ scene/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  })
})
