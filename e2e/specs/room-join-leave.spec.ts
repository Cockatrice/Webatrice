import { expect, test } from '@playwright/test';

import { LoginPage, RoomsPage } from '../pages';
import { randomUser } from '../fixtures/users';

// A fixture user registers, joins the default Magic room (Servatrice's seed
// `Magic - General`), confirms the game list renders, and leaves back to
// the rooms view. Exercises the room → games-list transition.

const E2E_HOST_LABEL = 'e2e';

test('join a room, see the game list, leave', async ({ page }) => {
  const login = new LoginPage(page);
  const rooms = new RoomsPage(page);
  const user = randomUser();

  await login.goto();
  await login.addHost(E2E_HOST_LABEL, 'localhost', 4748);
  await login.selectHost(E2E_HOST_LABEL);
  await login.register(user.username, user.password);
  await login.waitForRoomsView();
  await rooms.waitForRoomList();

  // The server seeds at least one room on boot; pick the first row from
  // the table rather than depending on the exact name, since the seed
  // can vary across servatrice releases.
  const firstJoinable = page.getByRole('button', { name: /^join$/i }).first();
  await expect(firstJoinable).toBeVisible({ timeout: 15_000 });
  await firstJoinable.click();
  await rooms.waitForGameList();

  await rooms.leaveRoom();
  await expect(page.getByRole('columnheader', { name: /^name$/i })).toBeVisible();
});
