import { expect, test } from '../fixtures/test';
import { tabTo } from '../fixtures/keyboard';
import { E2E_HOST_LABEL, joinFirstRoom, registerAndJoinFirstRoom, registerAndReachRooms } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';
import { GamePage, LoginPage, RoomsPage } from '../pages';

test('log in, join a room and join a game with the keyboard only', async ({ newContext }) => {
  test.setTimeout(240_000);
  const hostPage = await (await newContext()).newPage();
  const page = await (await newContext()).newPage();

  const host = await registerAndJoinFirstRoom(hostPage);
  const prefix = `kbd-${randomSuffix()}`;
  const gameDescription = `${prefix}-00`;
  await host.rooms.createGame(gameDescription, { maxPlayers: 2 });

  for (let owner = 0; owner < 3; owner++) {
    const ownerPage = owner === 0 ? hostPage : await (await newContext()).newPage();
    const session = owner === 0 ? host : await registerAndJoinFirstRoom(ownerPage);
    for (let slot = owner === 0 ? 1 : 0; slot < 5; slot++) {
      if (owner === 0 || slot > 0) {
        await session.rooms.waitForRoomList();
        await joinFirstRoom(ownerPage, session.rooms);
      }
      await session.rooms.createGame(`${prefix}-${String(owner * 5 + slot).padStart(2, '0')}`, { maxPlayers: 2 });
    }
  }

  const { user } = await registerAndReachRooms(page);
  await page.reload();
  const login = new LoginPage(page);
  await expect(login.hostPicker).toBeVisible();

  await tabTo(page, login.hostPicker);
  await page.keyboard.press('Enter');
  const listbox = page.getByRole('listbox', { name: /saved hosts/i });
  await tabTo(page, listbox);
  await page.keyboard.type(E2E_HOST_LABEL);
  const option = listbox.getByRole('option').filter({ hasText: new RegExp(`^${E2E_HOST_LABEL}`, 'i') }).first();
  await expect(listbox).toHaveAttribute('aria-activedescendant', (await option.getAttribute('id'))!);
  await page.keyboard.press('Enter');
  await expect(login.hostPicker).toBeFocused();
  await expect(login.loginButton).toBeEnabled({ timeout: 15_000 });

  await tabTo(page, page.getByLabel(/^username$/i));
  await page.keyboard.type(user.username);
  await tabTo(page, page.getByLabel(/^password$/i));
  await page.keyboard.type(user.password);
  await tabTo(page, login.loginButton);
  await page.keyboard.press('Enter');

  const joinRoom = new RoomsPage(page).roomsPanel.getByRole('button', { name: /^(join|open) /i }).first();
  await expect(joinRoom).toBeVisible({ timeout: 30_000 });
  await tabTo(page, joinRoom);
  await page.keyboard.press('Enter');

  const grid = page.getByRole('grid', { name: /^games in/i });
  const gameRow = grid.getByRole('row').filter({ hasText: gameDescription });
  await page.setViewportSize({ width: 1280, height: 720 });
  await tabTo(page, page.getByRole('button', { name: /^sort:/i }));
  await page.keyboard.press('Enter');
  const newestFirst = page.getByRole('menuitemradio', { name: /^newest first$/i });
  await expect(newestFirst).toBeVisible();
  for (let step = 0; step < 5 && !(await newestFirst.evaluate((item) => item === document.activeElement)); step++) {
    await page.keyboard.press('ArrowDown');
  }
  await expect(newestFirst).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(grid.getByRole('columnheader', { name: /^game/i })).toHaveAttribute('aria-sort', 'descending');
  await expect(gameRow).toHaveCount(0);
  const scroller = grid.locator('.virtual-list__list');
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0);
  await tabTo(page, grid.locator('[role="row"][tabindex="0"]'));
  let moves = 0;
  while (moves < 100) {
    if (await gameRow.count() && await gameRow.evaluate((row) => row === document.activeElement)) {
      break;
    }
    await page.keyboard.press('ArrowDown');
    moves++;
  }
  expect(moves).toBeGreaterThanOrEqual(10);
  await expect(gameRow).toHaveAttribute('aria-rowindex', String(moves + 2));
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(gameRow).toBeInViewport();
  await expect(gameRow).toBeFocused();
  await page.keyboard.press('Space');
  await expect(gameRow).toHaveAttribute('aria-selected', 'true');
  await expect(gameRow.getByRole('button', { name: /^join /i })).toBeEnabled();
  await page.keyboard.press('Enter');

  await new GamePage(page).deckSelect.waitForOpen();
});
