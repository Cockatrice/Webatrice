// Integration test suite. Builds a real Redux store via `createStore`, wires
// the Sockatrice response bridge with `attachResponseHandlers`, and drives
// `IWebClientResponse` handler methods (and the React provider stack) to
// assert end-to-end that protocol events land in the correct store slices.
// The line vs. the unit suite: integration tests span the store + bridge +
// listeners + React providers together; unit tests exercise a single module
// in isolation. Specs live in the top-level `integration/` directory.
import { defineConfig } from 'vitest/config';
import viteConfig from './vitest.config';

export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    include: ['integration/src/**/*.spec.ts', 'integration/src/**/*.spec.tsx'],
    exclude: ['node_modules', 'dist', 'coverage'],
    coverage: {
      ...viteConfig.test?.coverage,
      reportsDirectory: './coverage/integration',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/**/__mocks__/**',
        'src/__test-utils__/**',
        'src/testing/**',
        'src/setupTests.ts',
      ],
      // Integration-suite thresholds. Project-wide floor of 60/60/60/50, plus
      // a per-feature gate on `src/api/**` (the Sockatrice response bridge —
      // the suite's primary concern) at the same target. Both currently sit
      // well above this; the floor guards against regression.
      thresholds: {
        statements: 60,
        functions: 60,
        lines: 60,
        branches: 50,
        'src/api/**': {
          statements: 60,
          functions: 60,
          lines: 60,
          branches: 50,
        },
      },
    },
  },
});
