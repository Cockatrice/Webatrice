import { resolve } from 'node:path';

import { expect, test } from '../fixtures/test';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { t } from '../fixtures/i18n';
import { tabTo } from '../fixtures/keyboard';
import { randomSuffix } from '../fixtures/users';
import { GamePage } from '../pages';

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('play a turn of the board controls with the keyboard only', async ({ newContext }) => {
  test.setTimeout(180_000);
  const hostPage = await (await newContext()).newPage();
  const joinerPage = await (await newContext()).newPage();

  const [host, joiner] = await Promise.all([
    registerAndJoinFirstRoom(hostPage),
    registerAndJoinFirstRoom(joinerPage),
  ]);

  const gameDescription = `kbd-board-${randomSuffix()}`;
  await host.rooms.createGame(gameDescription, { maxPlayers: 2 });
  await joiner.rooms.joinGame(gameDescription);
  const hostGame = new GamePage(hostPage);
  const joinerGame = new GamePage(joinerPage);
  await Promise.all([hostGame.loadDeck(DECK_PATH), joinerGame.loadDeck(DECK_PATH)]);
  await Promise.all([hostGame.setReady(), joinerGame.setReady()]);
  await Promise.all([hostGame.waitForBoard(), joinerGame.waitForBoard()]);

  await expect.poll(async () => (await hostGame.canAdvancePhase()) !== (await joinerGame.canAdvancePhase()), {
    timeout: 15_000,
  }).toBe(true);
  const hostActive = await hostGame.canAdvancePhase();
  const watcher = hostActive ? joinerGame : hostGame;
  const page = hostActive ? hostPage : joinerPage;
  const [me, them] = hostActive ? [host.user.username, joiner.user.username] : [joiner.user.username, host.user.username];

  await page.keyboard.press('Shift+Enter');
  await expect(page.getByRole('combobox', { name: 'Game chat message' })).toBeFocused();

  const life = page.getByRole('spinbutton', { name: `${me}'s life` });
  await tabTo(page, life);
  await expect(life).toHaveAttribute('aria-valuenow', '20');
  await page.keyboard.press('ArrowUp');
  await expect(life).toHaveAttribute('aria-valuenow', '21', { timeout: 15_000 });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(life).toHaveAttribute('aria-valuenow', '19', { timeout: 15_000 });
  await expect(watcher.logLine(`${me} sets counter Life to 19 (-1).`)).toBeVisible({ timeout: 15_000 });

  const pool = page.getByRole('group', { name: 'Mana pool' }).first();
  await tabTo(page, pool.locator('[role="spinbutton"][tabindex="0"]'));
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
  }
  const green = pool.getByRole('spinbutton', { name: 'Green' });
  await expect(green).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(green).toHaveAttribute('aria-valuenow', '1', { timeout: 15_000 });
  await page.keyboard.press('ArrowDown');
  await expect(green).toHaveAttribute('aria-valuenow', '0', { timeout: 15_000 });

  const active = hostActive ? hostGame : joinerGame;
  const phases = page.getByRole('navigation', { name: 'Turn phases' });
  await expect(phases.getByRole('button', { name: 'Untap', exact: true })).toHaveAttribute('aria-current', 'step');
  const battlefield = active.localBoard.locator('[data-battlefield-owner]');
  await battlefield.click();
  await expect(battlefield).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(phases.getByRole('button', { name: 'Upkeep' })).toHaveAttribute('aria-current', 'step', { timeout: 15_000 });
  await expect(watcher.logLine('It is now the upkeep step.')).toBeVisible({ timeout: 15_000 });

  const libraryBefore = await watcher.zoneStackCount('deck', watcher.opponentBoard);
  await page.keyboard.press('Shift+Tab');
  const draw = phases.getByRole('button', { name: 'Draw', exact: true });
  await expect(draw).toHaveAttribute('aria-current', 'step', { timeout: 15_000 });
  await expect(watcher.logLine('It is now the draw step.')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => watcher.zoneStackCount('deck', watcher.opponentBoard), { timeout: 15_000 })
    .toBe(libraryBefore - 1);

  await page.keyboard.press('Shift+Enter');
  for (const control of [page.getByRole('log'), page.getByRole('separator', { name: 'Resize sidebar' })]) {
    await tabTo(page, control);
    await expect(control).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(control).not.toBeFocused();
    await expect(draw).toHaveAttribute('aria-current', 'step');
    await expect(watcher.container.getByRole('button', { name: 'Draw', exact: true })).toHaveAttribute('aria-current', 'step');
  }

  const upkeep = page.getByRole('navigation', { name: 'Turn phases' }).getByRole('button', { name: 'Upkeep' });
  await tabTo(page, upkeep);
  await page.keyboard.press('Enter');
  await expect(upkeep).toHaveAttribute('aria-current', 'step', { timeout: 15_000 });
  await expect(watcher.logLine('It is now the upkeep step.')).toHaveCount(2, { timeout: 15_000 });

  const dockTabs = page.getByRole('tablist', { name: 'Dock panels' });
  await tabTo(page, dockTabs.getByRole('tab', { name: 'Chat & log' }));
  await page.keyboard.press('ArrowRight');
  const playersTab = dockTabs.getByRole('tab', { name: /^Players/ });
  await expect(playersTab).toBeFocused();
  await expect(playersTab).toHaveAttribute('aria-selected', 'true');
  const more = page.getByRole('button', { name: `More actions for ${them}` });
  await tabTo(page, more);
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', {
    name: t('PlayerListContextMenu.label', { name: them }),
  });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
  await page.keyboard.type('pri');
  await expect(menu.getByRole('menuitem', {
    name: t('PlayerListContextMenu.privateChat'),
  })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();

  await page.keyboard.press('F3');
  const view = page.getByRole('dialog', { name: /library/i });
  await expect(view).toBeVisible({ timeout: 15_000 });
  await expect(view.getByRole('textbox', { name: 'Search the cards' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
  await expect(more).toBeFocused();
});
