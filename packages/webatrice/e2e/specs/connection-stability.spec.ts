import { expect, test } from '@playwright/test';

import { ConnectionStatus } from '../pages';
import { registerAndReachRooms } from '../fixtures/flows';

// Browser-environment connection-stability suite.
//
// Scope: validate the live browser WebSocket and the keep-alive Web Worker
// survive a foreground idle window in real Chromium. Sockatrice's e2e
// (`Sockatrice/e2e/specs/connection-stability.spec.ts`) validates the
// protocol layer against real Servatrice in node `ws`; the foreground soak
// below validates the *browser bundle* path: Vite emits the keepalive
// worker chunk with the bootstrap intact, Chromium loads it, the worker
// fires ticks, and the resulting Command_Ping cycle reaches real
// Servatrice. None of that is reachable from Sockatrice's node-`ws` soak.
//
// Assertion surface: the TopBar connection indicator (a lucide Circle
// with `aria-label="Connected"`), mounted iff Datatrice's
// `selectIsConnected` is true. There is no dedicated reconnect banner —
// indicator absent == not LOGGED_IN.
//
// Deferred: a *backgrounded-tab* soak (real OS-level tab-away keepalive).
// Playwright's `bringToFront()` is a no-op for `document.visibilityState`
// in headless Chromium (microsoft/playwright#2286, #22634); switching
// `channel: 'chrome'` doesn't help (the limitation is driver-level). Real
// Chrome backgrounded-tab throttling only starts after ~5 min hidden, so a
// faithful backgrounded test in this harness would need Xvfb + headed CI.
// Out of scope unless a user-visible regression motivates the infra cost.
//
// Also not covered (and why):
//   - Page-lifecycle freeze — `Page.setWebLifecycleState('frozen')` freezes
//     the keep-alive Web Worker too, defeating any such test.
//   - BFCache restore, `beforeunload` cleanup — need product surface that
//     doesn't exist yet.

test('connection holds for 60 s in the foreground', async ({ page }) => {
  test.setTimeout(120_000);
  await registerAndReachRooms(page);
  const status = new ConnectionStatus(page);
  await status.expectConnected();

  // Poll across the 60 s window. Sampling — rather than one wait-then-check —
  // catches a transient drop that self-heals before the final assertion.
  // 60 s comfortably outlasts Servatrice's default 15 s
  // `max_player_inactivity_time`, so the connection holding for this window
  // is evidence the keepalive worker is actually firing pings every 5 s.
  const SOAK_MS = 60_000;
  const POLL_MS = 2_000;
  const deadline = Date.now() + SOAK_MS;
  while (Date.now() < deadline) {
    await expect(status.indicator).toBeVisible({ timeout: 1_500 });
    await page.waitForTimeout(POLL_MS);
  }

  await status.expectConnected();
});

