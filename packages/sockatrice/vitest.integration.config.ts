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
    },
  },
});
