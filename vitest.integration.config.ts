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
export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    setupFiles: ['./integration/src/helpers/setup.ts'],
    include: ['integration/src/**/*.spec.{ts,tsx}'],
    exclude: ['node_modules', 'build', 'coverage'],
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
        'src/feature-core/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/store/**/*.{ts,tsx}',
        'src/AppShell.tsx',
        'src/AppShellRoutes.tsx',
        'src/clientConfig.ts',
      ],
      // Project-level integration gate. Floored at what the suite actually
      // clears today across the full scoped include (no per-feature
      // carve-outs); raise via ratchet. The cross-repo target is 60/60/60/50;
      // the gap reflects rooms, player, and the bulk of game that need
      // dedicated integration specs to grow into the standard.
      // Per-feature gates land flat at the cross-repo 60/60/60/50 target,
      // but only for `src/features/*` directories that already clear it.
      // Add a gate for a directory only after a green run proves it passes.
      thresholds: {
        statements: 45,
        functions: 40,
        lines: 45,
        branches: 30,
        'src/features/account/**': { statements: 60, functions: 60, lines: 60, branches: 50 },
        'src/features/decks/**':   { statements: 60, functions: 60, lines: 60, branches: 50 },
        'src/features/login/**':   { statements: 60, functions: 60, lines: 60, branches: 50 },
        'src/features/settings/**': { statements: 60, functions: 60, lines: 60, branches: 50 },
        'src/features/shell/**':   { statements: 60, functions: 60, lines: 60, branches: 50 },
      },
    },
  },
});
