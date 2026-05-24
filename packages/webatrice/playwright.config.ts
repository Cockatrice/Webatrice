// E2E test suite (`npm run test:e2e`).
//
// Purpose: drive the built Webatrice app in a real browser against a real
// Servatrice (started by `e2e/docker/docker-compose.e2e.yml`, which pulls
// `ghcr.io/cockatrice/servatrice`). Specs live in `e2e/specs/`.
//
// Boundary: this suite asserts only browser-WebSocket wiring — the app
// boots, the real browser WebSocket connects through to Servatrice, the
// connection survives a real page, and resources clean up on close. It does
// NOT re-test protocol correctness or keep-alive — those belong to Sockatrice.
//
// Coverage is intentionally not collected here; e2e is measured by user-flow
// coverage (which scenarios are covered), not line %.

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/specs',
  // Per-test default; specs that need longer (real-network flows) override
  // via the third arg to `test()`. Do NOT inflate the global timeout — short
  // specs like "boots & renders" should fail fast.
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // share one Servatrice instance
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `vite preview` serves the production build under build/ — assumes
    // `npm run build` has been run (the test:e2e orchestrator script does so).
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
