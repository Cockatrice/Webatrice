// Scope: the transport-layer half of the "stop tripping Servatrice's per-IP
// connection cap" fix. Servatrice counts every open socket from a peer address
// against security/max_users_per_address (default 4) at accept time — before
// login — so a probe that opens more than one socket, or leaks one, inflates
// that count. This spec proves, against real Servatrice, that each testConnect
// opens exactly ONE socket and releases it. The React trigger cadence (how
// often the app fires a probe) is a Webatrice concern, out of scope here; the
// unit suite (WebClient.spec.ts) pins close-on-every-path against a mock, and
// this proves the same against a live server + real ServerIdentification frame.
//
// localhost is in Servatrice's default trusted_sources, so the cap itself
// can't be reproduced from here — hence we assert socket accounting directly
// (one open per probe, all released) rather than a TOO_MANY_CONNECTIONS refusal.

import { describe, it, expect } from 'vitest';

import { WebClient } from '../../dist/index.js';

const E2E_TARGET = { host: 'localhost', port: '4749' } as const;

// > the default max_users_per_address (4): if probes leaked sockets, this many
// sequential probes would be exactly the kind of burst that trips the cap.
const PROBE_COUNT = 6;
const PROBE_TIMEOUT_MS = 10_000;

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

describe('test-connection socket release', () => {
  it('opens exactly one socket per probe and releases every one', async () => {

    const successSpy = WebClient.instance.response.session.testConnectionSuccessful as any;

    let constructed = 0;
    let live = 0;
    const OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = new Proxy(OriginalWebSocket, {
      construct(target, args: ConstructorParameters<typeof WebSocket>) {
        const socket = new target(...args);
        constructed += 1;
        live += 1;
        socket.addEventListener('close', () => {
          live -= 1;
        });
        return socket;
      },
    });

    try {
      for (let i = 0; i < PROBE_COUNT; i += 1) {
        const before = successSpy.mock.calls.length;
        WebClient.instance.testConnect({ ...E2E_TARGET });
        // Each probe must succeed against real Servatrice (valid identification).
        await waitFor(() => successSpy.mock.calls.length > before, PROBE_TIMEOUT_MS);
      }
    } finally {
      globalThis.WebSocket = OriginalWebSocket;
    }

    // One socket per probe — never a double-open (the burst that inflates the
    // per-IP count).
    expect(constructed).toBe(PROBE_COUNT);
    expect(successSpy.mock.calls.length).toBeGreaterThanOrEqual(PROBE_COUNT);

    // Every probe socket is released — the close frame lags the success
    // dispatch, so drain the event loop before asserting no leak remains.
    await waitFor(() => live === 0, PROBE_TIMEOUT_MS);
    expect(live).toBe(0);
  });
});
