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

test('login screen mounts and exposes the add-host dialog opener', async ({ page }) => {
  await page.goto('/login');

  // Webatrice's Login screen renders the LoginForm + its KnownHosts picker.
  // The picker is an MUI Select labelled "Host"; its Add-Host control lives
  // inside the portalled dropdown menu, so the spec has to open the Select
  // before the button is in the DOM.
  const hostPicker = page.getByRole('combobox', { name: /host/i });
  await expect(hostPicker).toBeVisible();
  await hostPicker.click();

  // Locate by text rather than role: the button renders inside <ul role=
  // "listbox">, where Chromium prunes non-option descendants from the
  // accessibility tree, so getByRole('button') can't see it even though
  // it's painted and clickable.
  // TODO(a11y): same pruning blocks screen-reader access — fix structurally
  // in KnownHosts.tsx by moving Add out of <Select>.
  const addHostTrigger = page.locator('button', { hasText: /add new host/i });
  await expect(addHostTrigger).toBeVisible();
  await addHostTrigger.click();

  // KnownHostDialog opening is interactive evidence the React tree is wired
  // up (the menu's portal uses role=listbox/presentation, not dialog, so
  // this matches the dialog uniquely).
  await expect(page.getByRole('dialog')).toBeVisible();
});
