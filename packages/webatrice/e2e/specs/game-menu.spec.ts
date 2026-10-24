import { resolve } from 'node:path';

import { expect, test } from '../fixtures/test';

import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('game menu: reverse turn order and next phase with action', async ({ newContext }) => {
  test.setTimeout(180_000);
  const hostPage = await (await newContext()).newPage();
  const joinerPage = await (await newContext()).newPage();

  const [host, joiner] = await Promise.all([
    registerAndJoinFirstRoom(hostPage),
    registerAndJoinFirstRoom(joinerPage),
  ]);

  const gameDescription = `e2e-${randomSuffix()}`;
  await host.rooms.createGame(gameDescription, { maxPlayers: 2, spectatorsAllowed: true });
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
  const [active, waiting] = hostActive ? [hostGame, joinerGame] : [joinerGame, hostGame];
  const waitingName = (hostActive ? joiner : host).user.username;

  await waiting.clickGameMenuItem('GameMenu.item.reverseTurn');
  const reversed = `${waitingName} reversed turn order, now it's reversed.`;
  await expect(active.logLine(reversed)).toBeVisible({ timeout: 15_000 });
  await expect(waiting.logLine(reversed)).toBeVisible({ timeout: 15_000 });

  await active.clickGameMenuItem('GameMenu.item.nextPhaseAction');
  await expect(waiting.logLine('It is now the upkeep step.')).toBeVisible({ timeout: 15_000 });

  const libraryBefore = await waiting.zoneStackCount('deck', waiting.opponentBoard);
  await active.clickGameMenuItem('GameMenu.item.nextPhaseAction');
  await expect(waiting.logLine('It is now the draw step.')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => waiting.zoneStackCount('deck', waiting.opponentBoard), { timeout: 15_000 })
    .toBe(libraryBefore - 1);
  await expect.poll(() => active.zoneStackCount('deck'), { timeout: 15_000 }).toBe(libraryBefore - 1);
});
