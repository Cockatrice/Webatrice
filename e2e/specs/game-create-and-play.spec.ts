import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

// Heavy two-context flow: host creates a game, joiner joins, both load
// the same minimal deck, both ready up, host draws + plays a card + ends
// turn, both leave. Exercises Webatrice UI + Sockatrice protocol +
// Datatrice reducers against real Servatrice — the migration-safety
// flow.
//
// Per-test timeout override (180s); do NOT raise the global timeout —
// fast specs must keep failing fast.

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('two clients create+join, load decks, draw, play, end turn', async ({ browser }) => {
  test.setTimeout(180_000);
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();

  try {
    const hostPage = await hostCtx.newPage();
    const joinerPage = await joinerCtx.newPage();

    const host = await registerAndJoinFirstRoom(hostPage);
    const joiner = await registerAndJoinFirstRoom(joinerPage);

    const gameDescription = `e2e-${randomSuffix()}`;

    await host.rooms.createGame(gameDescription, { maxPlayers: 2, spectatorsAllowed: true });
    const hostGame = new GamePage(hostPage);
    await hostGame.deckSelect.waitForOpen();

    await joiner.rooms.joinGame(gameDescription);
    const joinerGame = new GamePage(joinerPage);
    await joinerGame.deckSelect.waitForOpen();

    await hostGame.deckSelect.loadDeckFile(DECK_PATH);
    await hostGame.deckSelect.submitDeck();
    await joinerGame.deckSelect.loadDeckFile(DECK_PATH);
    await joinerGame.deckSelect.submitDeck();

    await hostGame.deckSelect.setReady();
    await joinerGame.deckSelect.setReady();

    await hostGame.waitForBoard();
    await joinerGame.waitForBoard();

    await hostGame.drawCard();
    await hostGame.endTurn();

    await hostGame.leaveGame();

    // Host leaving drops the game to one player; Servatrice reverts it to
    // lobby state and the joiner's DeckSelectDialog re-opens (expected —
    // mirrors desktop). The joiner leaves via that dialog's Leave Game button.
    await joinerGame.deckSelect.waitForOpen();
    await joinerGame.deckSelect.leaveGame();
    await expect(joinerGame.container).toBeHidden({ timeout: 30_000 });
  } finally {
    await hostCtx.close();
    await joinerCtx.close();
  }
});
