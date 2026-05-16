import { expect, test } from '@playwright/test';

import { LoginPage, RoomsPage } from '../pages';
import { randomUser } from '../fixtures/users';

// Test 2: login → join room.
//
// What this spec is REALLY for: prove that the real browser WebSocket can
// reach the live Servatrice in the docker harness from inside a real page.
// Sockatrice's e2e covers the protocol round-trip via Node `ws`; this spec
// covers the *browser* WebSocket impl + page-lifecycle integration that
// Sockatrice's suite cannot.
//
// Two checks are bundled:
//   - mount-and-open: the login screen renders and the Add-Host dialog
//     opens (cheap, broad regression net).
//   - register → login → known-host persistence → re-login: drives the
//     full flow once the broader page-object stack has been exercised at
//     least once in CI.

const E2E_HOST_LABEL = 'e2e';

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

test('register, login, known-host persisted, re-login', async ({ page }) => {
  const login = new LoginPage(page);
  const rooms = new RoomsPage(page);
  const user = randomUser();

  await login.goto();
  await login.addHost(E2E_HOST_LABEL, 'localhost', 4748);
  await login.selectHost(E2E_HOST_LABEL);
  await login.register(user.username, user.password);
  await login.waitForRoomsView();
  await rooms.waitForRoomList();

  // Reload to confirm the known-host entry persisted to IndexedDB. After
  // reload we land on /login again because the connection drops; the host
  // picker must already have our label, so `selectHost` (which waits on
  // the test-connection probe re-succeeding) suffices.
  await page.reload();
  await expect(login.hostPicker).toBeVisible();
  await login.selectHost(E2E_HOST_LABEL);

  await login.login(user.username, user.password);
  await login.waitForRoomsView();
  await rooms.waitForRoomList();
});
