// Unit test suite. Each spec (colocated as src/**/*.spec.ts) exercises a
// single module in isolation — command builders, event handlers, protobuf
// framing, utilities — in jsdom with no network and no WebSocket. Fast and
// deterministic; the coverage gate only ratchets up.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage', 'integration'],
    isolate: true,
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage/testing',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/__mocks__/**',
        'src/__test-utils__/**',
        'src/testing/**',
        'src/setupTests.ts',
      ],
      thresholds: {
        statements: 95,
        functions: 95,
        lines: 95,
        branches: 95,
      },
    },
  },
});
