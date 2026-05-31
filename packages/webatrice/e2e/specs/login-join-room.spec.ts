import { expect, test } from '@playwright/test';

import { E2E_HOST_LABEL, registerAndReachRooms } from '../fixtures/flows';

// Auth + IndexedDB persistence. Sockatrice's e2e covers the protocol
// round-trip via node `ws`; this spec covers the *browser* WebSocket impl
// + page-lifecycle integration that Sockatrice's suite cannot, with the
// added IndexedDB reload-and-rehydrate step that no other e2e exercises.
//
// (A separate "login screen mounts" smoke test used to live here; the
// same surface — host picker visible, Add-Host dialog opens, MUI Select
// pruning workaround — is exercised every time `LoginPage.addHost()`
// runs as part of the prologue below.)

test('register, login, known-host persisted, re-login', async ({ page }) => {
  const { login, rooms, user } = await registerAndReachRooms(page);

  // Reload to confirm the known-host entry persisted to IndexedDB. After
  // reload we land on /login again because the connection drops; the host
  // picker must already have our label, so `selectHost` (which waits on
  // the test-connection probe re-succeeding) suffices.
  await page.reload();
  await expect(login.hostPicker).toBeVisible();
  await login.selectHost(E2E_HOST_LABEL);

  await login.login(user.username, user.password);
  await rooms.waitForRoomList();
});
