// End-to-end test suite. Specs (e2e/specs/**/*.spec.ts) run against a real
// Servatrice (+ MySQL) stood up via e2e/docker/docker-compose.e2e.yml, using
// the `ws` package as the WebSocket implementation. They run sequentially in a
// single fork because they share one server and the WebClient singleton.
// Coverage is disabled — this suite is measured by user-flow coverage, not
// line %.

import { defineConfig } from 'vitest/config';
import viteConfig from './vitest.config';

export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    setupFiles: ['./e2e/setup/inject-websocket.ts'],
    globalSetup: ['./e2e/setup/global.ts'],
    include: ['e2e/specs/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    // Real network + WebClient singleton: specs must run sequentially against
    // the single servatrice container.
    fileParallelism: false,
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    testTimeout: 30_000,
    hookTimeout: 150_000,
    coverage: {
      ...viteConfig.test?.coverage,
      enabled: false,
    },
  },
});
