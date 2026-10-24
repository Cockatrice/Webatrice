import { resolve } from 'node:path';

import { expect, test } from '../fixtures/test';

import { GamePage, navRailLink } from '../pages';
import { joinFirstRoom, registerAndJoinFirstRoom, registerAndReachRooms } from '../fixtures/flows';
import { t } from '../fixtures/i18n';
import { randomSuffix } from '../fixtures/users';

const FOREST_DECK = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');
const CASTLE_DECK = resolve(__dirname, '..', 'fixtures', 'decks', 'castle-60.cod');

test('a hand card revealed to one player opens their reveal window with that card', async ({ newContext }) => {
  test.setTimeout(180_000);
  const hostCtx = await newContext();
  const joinerCtx = await newContext();
  const hostPage = await hostCtx.newPage();
  const joinerPage = await joinerCtx.newPage();

  const [host, joiner] = await Promise.all([
    registerAndJoinFirstRoom(hostPage),
    registerAndJoinFirstRoom(joinerPage),
  ]);

  const gameDescription = `reveal-${randomSuffix()}`;
  await host.rooms.createGame(gameDescription, { maxPlayers: 2 });
  const hostGame = new GamePage(hostPage);
  await joiner.rooms.joinGame(gameDescription);
  const joinerGame = new GamePage(joinerPage);

  await Promise.all([hostGame.loadDeck(FOREST_DECK), joinerGame.loadDeck(FOREST_DECK)]);
  await Promise.all([hostGame.setReady(), joinerGame.setReady()]);
  await Promise.all([hostGame.waitForBoard(), joinerGame.waitForBoard()]);

  await hostGame.drawCard();
  const forest = hostGame.handCard('Forest');
  await expect(forest).toBeVisible();
  await hostGame.chooseCardMenuPath(forest, t('CardMenu.revealTo'), joiner.user.username);

  const revealWindow = joinerPage.getByRole('heading', { name: `${host.user.username} reveals their hand` });
  await expect(revealWindow).toBeVisible({ timeout: 15_000 });
  const popup = revealWindow.locator('xpath=ancestor::div[contains(@class, "pointer-events-auto")][1]');
  await expect(popup.locator('[title="Forest"]')).toHaveCount(1);

  await expect(hostPage.getByRole('heading', { name: /reveals their/ })).toHaveCount(0);

  await hostGame.leaveGame();
});

test('"View related cards" shows the related card in the card-info pane', async ({ newContext }) => {
  test.setTimeout(180_000);
  const ctx = await newContext();
  const page = await ctx.newPage();
  const session = await registerAndJoinFirstRoom(page);

  await session.rooms.createGame(`related-${randomSuffix()}`, { maxPlayers: 1 });
  const game = new GamePage(page);
  await game.loadDeck(CASTLE_DECK);
  await game.setReady();
  await game.waitForBoard();

  await game.drawCard();
  await game.playCardFromHand('Castle Ardenvale');
  await expect(game.cardsOnBoard()).toHaveCount(1);

  await game.chooseCardMenuPath(game.cardsOnBoard().first(), t('CardMenu.viewRelated'), 'Human');

  await expect(page.getByTestId('card-preview-pane').locator('img[src*="00000000-0000-4000-8000-0000000e2e03"]').first())
    .toBeVisible({ timeout: 15_000 });

  await game.leaveGame();
});

test('Alt+1 sends the first message macro to the game chat', async ({ newContext }) => {
  test.setTimeout(180_000);
  const ctx = await newContext();
  const page = await ctx.newPage();
  const session = await registerAndReachRooms(page);

  await navRailLink(page, t('NavRail.place.settings')).click();
  await page.getByRole('navigation', { name: t('Settings.jumpTo') }).getByRole('button', { name: t('Settings.section.chat') }).click();
  await page.getByRole('textbox', { name: t('SettingsChat.macros.newLabel'), exact: true }).fill('e2e macro says hi');
  await page.getByRole('button', { name: t('SettingsChat.macros.add'), exact: true }).click();
  await expect(page.getByText('e2e macro says hi')).toBeVisible();

  await session.rooms.waitForRoomList();
  await joinFirstRoom(page, session.rooms);
  await session.rooms.createGame(`say-${randomSuffix()}`, { maxPlayers: 1 });
  const game = new GamePage(page);
  await game.loadDeck(FOREST_DECK);
  await game.setReady();
  await game.waitForBoard();

  await page.keyboard.press('Alt+Digit1');
  await expect(game.rightPanel.getByText('e2e macro says hi')).toBeVisible({ timeout: 15_000 });

  await game.leaveGame();
});
