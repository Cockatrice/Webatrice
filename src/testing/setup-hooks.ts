// Side-effecting Vitest setup module for Sockatrice integration tests.
//
// On import this file:
//   1. Installs the mock WebSocket constructor on `globalThis`.
//   2. Registers a `beforeEach` hook that activates fake timers and
//      builds a fresh WebClient singleton.
//   3. Registers an `afterEach` hook that resets module-private state and
//      restores real timers.
//
// Reference this module from `vitest.integration.config.ts` `setupFiles`
// (Sockatrice itself does so). Downstream consumers (e.g. Webatrice
// integration tests) can either reference this file directly via
// `@cockatrice/sockatrice/testing/setup-hooks` in their own vitest config or
// compose the equivalent setup with the exported primitives from
// `@cockatrice/sockatrice/testing` (`installMockWebSocket`,
// `createWebClientForTest`, `_resetAll`).

import { afterEach, beforeEach, vi } from 'vitest';

import { installMockWebSocket, createWebClientForTest, _resetAll } from './setup';

installMockWebSocket();

beforeEach(() => {
  vi.useFakeTimers();
  createWebClientForTest();
});

afterEach(() => {
  _resetAll();
  vi.clearAllMocks();
  vi.useRealTimers();
});
