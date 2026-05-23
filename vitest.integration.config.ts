// Integration test suite. Wires the real WebClient, WebSocketService,
// ProtobufService, and command/event layers together against a mocked
// WebSocket constructor (no live server) — verifies the protocol layers
// cooperate across full command/response and event round-trips. The line vs.
// the unit suite: integration tests span the WebClient and its services;
// unit tests never do.

import { defineConfig } from 'vitest/config';
import viteConfig from './vitest.config';

export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    setupFiles: ['./src/testing/setup-hooks.ts'],
    include: ['integration/src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    coverage: {
      ...viteConfig.test?.coverage,
      reportsDirectory: './coverage/integration',
      include: ['src/**/*.ts'],
      thresholds: {
        // Project-wide floor.
        statements: 60,
        functions: 60,
        lines: 60,
        branches: 50,
        // Per-feature floors for the command and event layers — same
        // 60/60/60/50 target as the project gate, applied per-glob so no
        // single feature area can collapse while the aggregate stays green.
        // Both globs currently sit well above this; the floor is deliberately
        // kept at the target (not ratcheted to current) for a smoother
        // development experience.
        'src/commands/**': {
          statements: 60,
          functions: 60,
          lines: 60,
          branches: 50,
        },
        'src/events/**': {
          statements: 60,
          functions: 60,
          lines: 60,
          branches: 50,
        },
      },
    },
  },
});
