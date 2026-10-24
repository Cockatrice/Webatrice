import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Integration test suite (`npm run test:integration` / `test:integration:coverage`).
//
// Purpose: exercise feature flows and command/event round-trips against a real
// Redux store and real Datatrice reducers, driven by protobuf payloads. Specs
// live in the top-level `integration/` tree as `integration/src/**/*.spec.{ts,tsx}`.
//
// Boundary: only the WebSocket *constructor* is mocked (see
// `integration/src/helpers/setup.ts`) — everything downstream of the socket is
// real. There is no real browser and no real Servatrice; tests needing those
// belong in the e2e suite (`playwright.config.ts`). This suite is not a
// superset of the unit suite — it deliberately exercises different paths.
const REAL_DEXIE_SPECS = 'integration/src/services/dexie/**/*.spec.ts';

export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    setupFiles: ['./integration/src/helpers/setup.ts'],
    include: [],
    exclude: ['node_modules', 'build', 'coverage'],
    pool: 'vmThreads',
    execArgv: [],
    projects: [
      {
        extends: true,
        test: { name: 'integration', include: ['integration/src/**/*.spec.{ts,tsx}'], exclude: [REAL_DEXIE_SPECS] },
      },
      {
        extends: true,
        test: { name: 'integration-dexie', include: [REAL_DEXIE_SPECS], pool: 'threads' },
      },
    ],
    coverage: {
      ...viteConfig.test?.coverage,
      reportsDirectory: './coverage/integration',
      // The integration suite owns feature flows + store / app-shell wiring.
      // Pure leaf UI (`components/`, `dialogs/`) and pure utilities are the
      // unit suite's domain, so they are scoped out of the integration gate.
      // `feature-widgets/` has dedicated unit coverage and is not the
      // integration suite's primary concern.
      include: [
        'src/features/**/*.{ts,tsx}',
        'src/feature-wrappers/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/store/**/*.{ts,tsx}',
        'src/AppShell.tsx',
        'src/AppShellRoutes.tsx',
        'src/clientConfig.ts',
      ],
    },
  },
});
