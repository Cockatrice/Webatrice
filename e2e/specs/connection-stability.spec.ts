// Scope: validates the WebClient protocol layer holds against real Servatrice
// in node — proves keep-alive ping/pong cadence and Servatrice's idle policy
// stay compatible. The runtime here is node + the `ws` package, NOT a real
// browser; this spec does NOT validate browser-environment behavior
// (tab-visibility throttling, page-lifecycle / BFCache, `beforeunload`
// cleanup, browser-native close-code semantics). Those are owned by
// `Webatrice/e2e/specs/connection-stability.spec.ts`, which drives the same
// Servatrice from a real Chromium page.

import { describe, it, expect } from 'vitest';

import { AuthenticationCommands, WebClient } from '../../dist/index.js';
import { WebsocketTypes } from '../../dist/types/index.js';
import { generateUniqueUser, waitForStatus } from '../helpers/e2e-client';

const SOAK_DURATION_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;
// 120s soak + 25s login wait + slack. The e2e suite's global testTimeout is
// 30s, so this per-test override is required (the fast register-and-login
// spec keeps the default 30s budget).
const TEST_TIMEOUT_MS = 180_000;

describe('connection-stability', () => {
  it(
    'holds a logged-in connection for two minutes with no reconnects',
    async () => {
      const user = generateUniqueUser();

      AuthenticationCommands.register({
        host: 'localhost',
        port: '4749',
        userName: user.userName,
        password: user.password,
        email: user.email,
        country: 'us',
        realName: 'E2E Soak',
      });

      await waitForStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 25_000);

      // Poll status across the soak window. Polling — rather than one
      // sleep-then-check — catches a transient RECONNECTING blip that would
      // self-heal before a final check.
      //
      // Keep-alive is asserted *indirectly*: KeepAliveService calls
      // onDisconnected() — flipping status away from LOGGED_IN — the moment
      // two keep-alive ticks pass with no intervening pong. At the e2e
      // keepalive of 5s, a 120s hold spans ~24 ping/pong cycles, so "stayed
      // LOGGED_IN for the whole window" is itself proof that pongs kept
      // flowing. (Protocol-level keep-alive correctness is owned by the unit
      // and integration suites; this spec only proves it holds against a real
      // Servatrice over a sustained connection.)
      const samples: WebsocketTypes.StatusEnum[] = [];
      const deadline = Date.now() + SOAK_DURATION_MS;
      while (Date.now() < deadline) {
        samples.push(WebClient.instance.status);
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      expect(samples.length).toBeGreaterThan(0);
      expect([...new Set(samples)]).toEqual([WebsocketTypes.StatusEnum.LOGGED_IN]);
      expect(samples).not.toContain(WebsocketTypes.StatusEnum.RECONNECTING);
      expect(samples).not.toContain(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(samples).not.toContain(WebsocketTypes.StatusEnum.DISCONNECTING);
      expect(WebClient.instance.status).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
    },
    TEST_TIMEOUT_MS,
  );
});
