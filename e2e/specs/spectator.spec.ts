import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

// Three clients: host + joiner start a game, spectator joins as a
// third context. Assertions:
//   - spectator sees the `spectating-tag` chip in the right panel.
//   - spectator does NOT see the deck-select dialog (it's gated on
//     `!isSpectator` in `useGame.ts`'s `deckSelectOpen` predicate).
//   - spectator can leave; the host/joiner game stays alive.

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('third client spectates a game in progress', async ({ browser }) => {
  test.setTimeout(180_000);
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();
  const spectatorCtx = await browser.newContext();

  try {
    const hostPage = await hostCtx.newPage();
    const joinerPage = await joinerCtx.newPage();
    const spectatorPage = await spectatorCtx.newPage();

    const host = await registerAndJoinFirstRoom(hostPage);
    const joiner = await registerAndJoinFirstRoom(joinerPage);
    const spectator = await registerAndJoinFirstRoom(spectatorPage);

    const gameDescription = `spec-${randomSuffix()}`;
    await host.rooms.createGame(gameDescription, { maxPlayers: 2, spectatorsAllowed: true });

    const hostGame = new GamePage(hostPage);
    const joinerGame = new GamePage(joinerPage);
    const spectatorGame = new GamePage(spectatorPage);

    await hostGame.deckSelect.waitForOpen();
    await joiner.rooms.joinGame(gameDescription);
    await joinerGame.deckSelect.waitForOpen();

    await hostGame.deckSelect.loadDeckFile(DECK_PATH);
    await hostGame.deckSelect.submitDeck();
    await joinerGame.deckSelect.loadDeckFile(DECK_PATH);
    await joinerGame.deckSelect.submitDeck();

    await hostGame.deckSelect.setReady();
    await joinerGame.deckSelect.setReady();
    await hostGame.waitForBoard();
    await joinerGame.waitForBoard();

    await spectator.rooms.joinGame(gameDescription, { spectator: true });
    await spectatorGame.waitForBoard();

    await expect(spectatorGame.spectatingTag).toBeVisible();
    await expect(spectatorPage.locator('.DeckSelectDialog')).toBeHidden();

    await spectatorGame.leaveGame();

    await expect(hostGame.container).toBeVisible();
    await expect(joinerGame.container).toBeVisible();

    await hostGame.leaveGame();

    // See game-create-and-play.spec.ts: host leaving reverts the game to
    // lobby state and the joiner's DeckSelectDialog re-opens. The joiner
    // leaves via that dialog's Leave Game button.
    await joinerGame.deckSelect.waitForOpen();
    await joinerGame.deckSelect.leaveGame();
    await expect(joinerGame.container).toBeHidden({ timeout: 30_000 });
  } finally {
    await hostCtx.close();
    await joinerCtx.close();
    await spectatorCtx.close();
  }
});
