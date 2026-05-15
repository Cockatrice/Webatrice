import { expect, test } from '@playwright/test';

// Test 2: login → join room.
//
// What this spec is REALLY for: prove that the real browser WebSocket can
// reach the live Servatrice in the docker harness from inside a real page.
// Sockatrice's e2e covers the protocol round-trip via Node `ws`; this spec
// covers the *browser* WebSocket impl + page-lifecycle integration that
// Sockatrice's suite cannot.
//
// Coverage today: navigates the app, waits for the login screen to render,
// and asserts an interactive control (the "Add Host" dialog opener) exists
// and can open the dialog. That confirms the bundle loaded, the React tree
// is interactive, and dialog routing works in a real browser.
//
// TODO (extending): drive a real registration → login → join-room flow:
//   1. Open Add Host dialog, enter `localhost`, port `4748`, save.
//   2. Pick that host. Click Register, fill the registration form with
//      `e2e_<rand>`, submit.
//   3. Wait for the post-login redirect to the rooms list (`/server`).
//   4. Click into a room, assert the Room view renders.
// The first iteration of this spec is selector-tolerant on purpose; flesh
// out steps 1–4 once the harness has run green at least once in CI.

const FLOW_TIMEOUT_MS = 60_000;

test(
  'login screen mounts and exposes the add-host dialog opener',
  async ({ page }) => {
    await page.goto('/login');

    // Webatrice's Login screen renders the LoginForm + its KnownHosts
    // picker. The picker exposes an "Add" / Add Host control to open a new
    // KnownHostDialog. Use a forgiving role-and-name lookup so a label
    // tweak doesn't break the spec.
    const addHostTrigger = page.getByRole('button', { name: /add/i }).first();
    await expect(addHostTrigger).toBeVisible({ timeout: FLOW_TIMEOUT_MS });
    await addHostTrigger.click();

    // Either the KnownHostDialog opens (preferred), or the registration
    // dialog opens — either is interactive evidence the React tree is
    // wired up. Look for any dialog role becoming visible.
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  },
  FLOW_TIMEOUT_MS + 30_000,
);
