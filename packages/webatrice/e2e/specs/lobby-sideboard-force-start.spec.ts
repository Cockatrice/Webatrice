import { resolve } from 'node:path';

import { expect, test } from '../fixtures/test';

import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-island-side.cod');

test('sideboard swap before ready, then host force start kicks the unready player', async ({ newContext }) => {
  test.setTimeout(180_000);
  const hostCtx = await newContext();
  const joinerCtx = await newContext();

  const hostPage = await hostCtx.newPage();
  const joinerPage = await joinerCtx.newPage();

  const [host, joiner] = await Promise.all([
    registerAndJoinFirstRoom(hostPage),
    registerAndJoinFirstRoom(joinerPage),
  ]);

  const gameDescription = `e2e-force-${randomSuffix()}`;
  await host.rooms.createGame(gameDescription, { maxPlayers: 2, spectatorsAllowed: true });
  const hostGame = new GamePage(hostPage);
  await joiner.rooms.joinGame(gameDescription);
  const joinerGame = new GamePage(joinerPage);
  await Promise.all([hostGame.deckSelect.waitForOpen(), joinerGame.deckSelect.waitForOpen()]);

  await hostGame.deckSelect.loadDeckFile(DECK_PATH);
  await hostGame.deckSelect.submitDeck();
  await expect(hostGame.deckSelect.deckView).toBeVisible();

  await hostGame.deckSelect.unlockSideboard();
  await hostGame.deckSelect.moveDeckCard('Island', 'side');

  await hostGame.deckSelect.forceStart();
  await hostGame.waitForBoard();

  await expect.poll(() => hostGame.zoneStackCount('deck'), { timeout: 15_000 }).toBe(61);

  await expect(joinerGame.deckSelect.lobby).toBeHidden({ timeout: 30_000 });
  await expect(joinerGame.container).toBeHidden();

  await hostGame.leaveGame();
});
