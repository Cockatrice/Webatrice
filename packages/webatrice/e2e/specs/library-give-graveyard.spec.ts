import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';
import { dragTo } from '../fixtures/dnd';

// Two-context flow exercising the popup-drag + cross-player control path against
// real Servatrice:
//   1. host opens "View library" (deck dump → ZoneViewDialog),
//   2. drags a card from the library popup onto their battlefield (the popup
//      prunes it — revealedCards sync),
//   3. gives it to the opponent by dragging it onto the opponent's battlefield
//      row (TABLE is the only zone that accepts a cross-player move),
//   4. the opponent sends that card to their own graveyard (owner-tree routing).

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('view library → drag to battlefield → give to opponent → opponent graveyards it', async ({ browser }) => {
  test.setTimeout(180_000);
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();

  try {
    const hostPage = await hostCtx.newPage();
    const joinerPage = await joinerCtx.newPage();

    const [host, joiner] = await Promise.all([
      registerAndJoinFirstRoom(hostPage),
      registerAndJoinFirstRoom(joinerPage),
    ]);

    const gameDescription = `give-${randomSuffix()}`;
    await host.rooms.createGame(gameDescription, { maxPlayers: 2 });
    const hostGame = new GamePage(hostPage);
    await joiner.rooms.joinGame(gameDescription);
    const joinerGame = new GamePage(joinerPage);

    await Promise.all([hostGame.deckSelect.waitForOpen(), joinerGame.deckSelect.waitForOpen()]);
    await Promise.all([
      (async () => {
        await hostGame.deckSelect.loadDeckFile(DECK_PATH);
        await hostGame.deckSelect.submitDeck();
      })(),
      (async () => {
        await joinerGame.deckSelect.loadDeckFile(DECK_PATH);
        await joinerGame.deckSelect.submitDeck();
      })(),
    ]);
    await Promise.all([hostGame.deckSelect.setReady(), joinerGame.deckSelect.setReady()]);
    await Promise.all([hostGame.waitForBoard(), joinerGame.waitForBoard()]);

    // 1. View library — the dump populates the popup with the deck's cards.
    const library = await hostGame.openZoneView('deck', /library/i);
    const before = await hostGame.zoneViewCards(library).count();
    expect(before).toBeGreaterThan(0);

    // 2. Drag a library card onto the host's own battlefield.
    await dragTo(hostPage, hostGame.zoneViewCards(library).first(), hostGame.battlefieldRow());
    await expect(hostGame.cardsOnBoard()).toHaveCount(1);
    // The library popup pruned the moved card (revealedCards sync).
    await expect(hostGame.zoneViewCards(library)).toHaveCount(before - 1);

    // Close the library popup so it can't intercept the next drag.
    await library.getByRole('button', { name: /close zone view/i }).click();
    await expect(library).toBeHidden();

    // 3. Give the card to the opponent: drag it onto the opponent's battlefield row.
    await dragTo(hostPage, hostGame.cardsOnBoard().first(), hostGame.battlefieldRow(hostGame.opponentBoard));
    await expect(hostGame.cardsOnBoard(hostGame.opponentBoard)).toHaveCount(1);
    await expect(hostGame.cardsOnBoard()).toHaveCount(0);

    // 4. On the joiner client, the card now sits on the joiner's own board.
    //    Send it to the graveyard → it lands in the joiner's graveyard.
    await expect(joinerGame.cardsOnBoard(joinerGame.localBoard)).toHaveCount(1);
    await joinerGame.moveViaCardMenu(
      joinerGame.cardsOnBoard(joinerGame.localBoard).first(),
      /send to graveyard/i,
    );
    await expect.poll(() => joinerGame.zoneStackCount('grave')).toBe(1);
    await expect(joinerGame.cardsOnBoard(joinerGame.localBoard)).toHaveCount(0);

    // Teardown: host leaves (reverts joiner to lobby), joiner leaves via deck-select.
    await hostGame.leaveGame();
    await joinerGame.deckSelect.waitForOpen();
    await joinerGame.deckSelect.leaveGame();
    await expect(joinerGame.container).toBeHidden({ timeout: 30_000 });
  } finally {
    await hostCtx.close();
    await joinerCtx.close();
  }
});
