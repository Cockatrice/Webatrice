import { expect, test } from '@playwright/test';

import { ConnectionStatus, RoomsPage } from '../pages';
import { registerAndReachRooms } from '../fixtures/flows';

// Browser-environment connection-stability suite.
//
// Scope: validate the live browser WebSocket and the keep-alive Web Worker
// survive a foreground idle window and SPA navigation in real Chromium.
// Sockatrice's e2e (`Sockatrice/e2e/specs/connection-stability.spec.ts`)
// validates the protocol layer against real Servatrice in node `ws`; the
// foreground soak below validates the *browser bundle* path: Vite emits
// the keepalive worker chunk with the bootstrap intact, Chromium loads it,
// the worker fires ticks, and the resulting Command_Ping cycle reaches real
// Servatrice. None of that is reachable from Sockatrice's node-`ws` soak.
//
// Assertion surface: the LeftNav status indicator
// (`.LeftNav-server__indicator`), mounted iff Datatrice's
// `selectIsConnected` is true. There is no dedicated reconnect banner —
// indicator hidden == not LOGGED_IN.
//
// The SPA-navigation test also subsumes the standalone room-join/leave
// flow (it joins the first seeded room, waits for the game list, and
// leaves) with stronger assertions — the ConnectionStatus indicator must
// stay green across both transitions.
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

test('connection persists across SPA navigation (rooms → room → rooms)', async ({ page }) => {
  // Register + two SPA navigations involve several real server round-trips;
  // the default 30 s test budget is too tight and flakes under load. This is
  // not a soak — 60 s is ample headroom (the run completes in ~20 s).
  test.setTimeout(60_000);
  await registerAndReachRooms(page);
  const rooms = new RoomsPage(page);
  const status = new ConnectionStatus(page);

  await rooms.waitForRoomList();
  await status.expectConnected();

  // Server seeds at least one joinable room; pick the first row rather than
  // depending on a name that can vary across servatrice releases. Joining
  // and leaving exercises the React Router transition between /server and
  // /room/:roomId without a full-page reload, which would legitimately
  // drop the socket. `leaveRoom` uses the LeftNav logo NavLink for SPA
  // routing — the "don't reload" pattern documented on `RoomsPage`.
  const firstJoinable = page.getByRole('button', { name: /^join$/i }).first();
  await expect(firstJoinable).toBeVisible({ timeout: 15_000 });
  await firstJoinable.click();
  await rooms.waitForGameList();
  await status.expectConnected();

  await rooms.leaveRoom();
  await status.expectConnected();
});
