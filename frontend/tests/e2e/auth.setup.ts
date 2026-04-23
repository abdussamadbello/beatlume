import * as fs from 'node:fs'
import * as path from 'node:path'
import { test as setup, expect } from '@playwright/test'

const authFile = path.join(process.cwd(), 'playwright', '.auth', 'user.json')

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.goto('/login')
  await page.getByPlaceholder('you@example.com').fill('elena@beatlume.io')
  await page.getByPlaceholder('Enter your password').fill('beatlume123')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 })
  await page.context().storageState({ path: authFile })
})
