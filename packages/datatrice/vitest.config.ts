// Unit test suite. Exercises reducers, actions, selectors, listeners, and
// utilities in isolation — each module tested directly, no cross-slice store
// wiring. The line vs. the integration suite: integration tests build a real
// store and drive the Sockatrice response bridge end to end; unit tests never
// do. Integration specs live in the top-level `integration/` directory and
// run from `vitest.integration.config.ts`.
import { defineConfig } from 'vitest/config';

// Sockatrice's compiled output uses extensionless imports inside
// `dist/generated/index.js` (e.g. `export * from './proto/admin_commands_pb'`)
// which native Node ESM cannot resolve. Inlining routes sockatrice through
// vite's transform pipeline, which fills in the extension. Webatrice's
// vite.config.ts does the same.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    exclude: ['node_modules', 'dist', 'coverage'],
    isolate: true,
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 10000,
    server: {
      deps: {
        inline: ['@cockatrice/sockatrice'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage/testing',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/**/__mocks__/**',
        'src/__test-utils__/**',
        'src/testing/**',
        'src/setupTests.ts',
      ],
      // Unit-suite thresholds — the agreed cross-repo standard of
      // 95/95/95/90. Integration coverage is gated separately via
      // vitest.integration.config.ts. Ratchet up only.
      thresholds: {
        statements: 95,
        functions: 95,
        lines: 95,
        branches: 90,
      },
    },
  },
});
