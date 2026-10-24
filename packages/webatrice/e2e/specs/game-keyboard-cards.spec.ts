import { resolve } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { t } from '../fixtures/i18n';
import { tabTo } from '../fixtures/keyboard';
import { randomSuffix } from '../fixtures/users';
import { GamePage } from '../pages';

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

async function arrowToItem(page: Page, menu: Locator, name: string): Promise<void> {
  const item = menu.getByRole('menuitem', { name, exact: true });
  const focused = menu.locator(':focus');
  await expect(focused).toHaveCount(1);
  for (let i = 0; i < 40; i++) {
    if (await item.evaluate((el) => el === document.activeElement)) {
      return;
    }
    const before = await focused.textContent();
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => ((await focused.count()) === 1 ? focused.textContent() : before)).not.toBe(before);
  }
  throw new Error(`ArrowDown never reached "${name}"`);
}

async function moveWithDialog(page: Page, name: string, to?: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: `Move ${name}` });
  const toBox = dialog.getByLabel('To', { exact: true });
  await expect(toBox).toBeFocused();
  await toBox.click({ trial: true, timeout: 5_000 });
  if (to) {
    await toBox.selectOption(to);
  }
  await tabTo(page, dialog.getByRole('button', { name: 'Move', exact: true }));
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
}

test('draw, play, tap, point and bin a card with the keyboard only', async ({ newContext }) => {
  test.setTimeout(180_000);
  const hostPage = await (await newContext()).newPage();
  const joinerPage = await (await newContext()).newPage();

  const [host, joiner] = await Promise.all([
    registerAndJoinFirstRoom(hostPage),
    registerAndJoinFirstRoom(joinerPage),
  ]);

  const gameDescription = `kbd-cards-${randomSuffix()}`;
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
  const [game, watcher] = hostActive ? [hostGame, joinerGame] : [joinerGame, hostGame];
  const page = hostActive ? hostPage : joinerPage;
  await page.mouse.move(0, 0);
  const [me, them] = hostActive ? [host.user.username, joiner.user.username] : [joiner.user.username, host.user.username];

  const hand = page.getByRole('listbox', { name: new RegExp(`^${me}'s hand`) });
  const battlefield = page.getByRole('listbox', { name: new RegExp(`^${me}'s battlefield`) });
  const phases = page.getByRole('navigation', { name: t('PhaseTrack.label') });

  await page.keyboard.press('Shift+Enter');
  await expect(page.getByRole('combobox', { name: 'Game chat message' })).toBeFocused();

  const handBefore = await hand.getByRole('option').count();
  const library = game.zoneStack('deck');
  await tabTo(page, library);
  await page.keyboard.press('Enter');
  const libraryMenu = page.getByRole('menu', { name: t('ZoneStack.library'), exact: true });
  await expect(libraryMenu.getByRole('menuitem', {
    name: t('ShortcutsTab.action.game.drawCard'), exact: true,
  })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(hand.getByRole('option')).toHaveCount(handBefore + 1, { timeout: 15_000 });
  await expect(library).toBeFocused();

  const firstCard = hand.locator('[role="option"][tabindex="0"]');
  await tabTo(page, firstCard);
  await expect(phases.getByRole('button', {
    name: t('GamePhase.untap.short'), exact: true,
  })).toHaveAttribute('aria-current', 'step');
  await page.keyboard.press('Tab');
  await expect(phases.getByRole('button', {
    name: t('GamePhase.upkeep.short'),
  })).toHaveAttribute('aria-current', 'step', { timeout: 15_000 });
  await expect(watcher.logLine('It is now the upkeep step.')).toBeVisible({ timeout: 15_000 });
  await expect(firstCard).toBeFocused();
  await page.keyboard.press('F6');
  await expect(hand.getByRole('option').filter({ has: page.locator(':focus') })).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.closest('[role="listbox"]') == null)).toBe(true);
  await tabTo(page, firstCard);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const forest = battlefield.getByRole('option', { name: /^Forest/ }).first();
  await expect(forest).toBeVisible({ timeout: 15_000 });
  await expect(watcher.opponentBoard.locator('[data-card][data-zone="battlefield"]')).toHaveCount(1, { timeout: 15_000 });

  await tabTo(page, forest);
  await page.keyboard.press('Enter');
  await expect(forest).toHaveAccessibleName('Forest, tapped', { timeout: 15_000 });
  await expect(watcher.opponentBoard.getByRole('option', { name: 'Forest, tapped' })).toBeVisible({ timeout: 15_000 });

  await page.keyboard.press('Shift+F10');
  const cardMenu = page.getByRole('menu', { name: 'Forest' });
  await expect(cardMenu).toBeVisible();
  await arrowToItem(page, cardMenu, t('CardMenu.drawArrow'));
  await page.keyboard.press('Enter');
  await expect(page.getByText(t('PendingTargetAnnouncer.arrow', { name: 'Forest' }))).toBeAttached();
  const theirLife = page.getByRole('button', { name: `${them}'s life` });
  await tabTo(page, theirLife);
  await page.keyboard.press('Enter');
  await expect(watcher.logLine(`${me} points from their Forest to ${them}.`)).toBeVisible({ timeout: 15_000 });

  await tabTo(page, forest);
  await page.keyboard.press('Shift+F10');
  await expect(cardMenu).toBeVisible();
  await arrowToItem(page, cardMenu, t('CardMenu.moveTo'));
  await page.keyboard.press('ArrowRight');
  const moveMenu = page.getByRole('menu', { name: t('CardMenu.moveTo'), exact: true });
  await arrowToItem(page, moveMenu, t('ZoneLabel.title.grave'));
  await page.keyboard.press('Enter');
  const graveyardName = t('ZoneStack.pileWithTop', {
    zone: t('ZoneStack.graveyard'), count: 1, top: 'Forest',
  });
  await expect(game.localTray.getByRole('button', { name: graveyardName })).toBeVisible({ timeout: 15_000 });
  await expect(watcher.opponentBoard.getByRole('button', { name: graveyardName })).toBeVisible({ timeout: 15_000 });

  const graveyard = game.localTray.getByRole('button', { name: graveyardName });
  await page.keyboard.press('Shift+Enter');
  await tabTo(page, graveyard);
  await page.keyboard.press('Enter');
  const graveMenu = page.getByRole('menu').filter({ has: page.getByRole('menuitem', { name: 'View graveyard', exact: true }) });
  await arrowToItem(page, graveMenu, 'View graveyard');
  await page.keyboard.press('Enter');
  const graveView = page.locator('.pointer-events-auto.resize').filter({ has: page.getByRole('heading', { name: /graveyard/i }) });
  await tabTo(page, graveView.getByRole('option', { name: /^Forest/ }));
  await page.keyboard.press('m');
  await moveWithDialog(page, 'Forest', 'exile');
  await expect(watcher.opponentBoard.getByRole('button', { name: /^Exile, 1 card/ })).toBeVisible({ timeout: 15_000 });

  const watcherPage = hostActive ? joinerPage : hostPage;
  await watcher.localTray.getByRole('button', { name: /^Library, \d+ cards/ }).focus();
  await watcherPage.keyboard.press('Enter');
  await arrowToItem(watcherPage, watcherPage.getByRole('menu', { name: 'Library' }), 'Lend library to...');
  await watcherPage.keyboard.press('ArrowRight');
  await arrowToItem(watcherPage, watcherPage.getByRole('menu', { name: 'Lend library to...' }), me);
  await watcherPage.keyboard.press('Enter');
  const lentCard = page.getByRole('button', { name: 'Move Forest to a battlefield' }).first();
  await lentCard.waitFor();
  await page.keyboard.press('Shift+Enter');
  await tabTo(page, lentCard);
  await page.keyboard.press('m');
  await moveWithDialog(page, 'Forest');
  await expect(battlefield.getByRole('option', { name: /^Forest/ })).toHaveCount(1, { timeout: 15_000 });
  await expect(watcher.opponentBoard.locator('[data-card][data-zone="battlefield"]')).toHaveCount(1, { timeout: 15_000 });
});
