/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

// Written by tests/e2e/auth.setup.ts (path relative to frontend/ when using npm run test:e2e)
const authFile = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /auth\.spec\.ts/],
    },
    {
      name: 'chromium-auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      // Run after setup; does not use storageState (exercises /login in tests).
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'VITE_API_URL=http://localhost:8000 npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
