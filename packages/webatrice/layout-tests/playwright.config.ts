import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.LAYOUT_PORT ?? 4174);

export default defineConfig({
  testDir: './specs',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: '../test-results/layout',
  use: {
    baseURL: `http://localhost:${PORT}`,
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `node ../../node_modules/vite/bin/vite.js --port ${PORT} --strictPort --open false`,
    cwd: '..',
    url: `http://localhost:${PORT}/layout-tests/harness.html`,
    env: { BROWSER: 'none' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
