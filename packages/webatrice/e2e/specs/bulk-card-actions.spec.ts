import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

// Single-player flow exercising BULK card actions against real Servatrice — the
// one layer that proves the server accepts a single CommandContainer carrying
// many game commands (and a multi-card ListOfCardsToMove) and applies it
// atomically. The unit + integration suites use a mock socket and only verify
// the client builds the batch; here both batching shapes round-trip for real:
//   1. Bulk tap   : box-select 2 battlefield cards, double-click one → both tap
//                   (many Command_SetCardAttr in one container).
//   2. Bulk move  : with both still/again selected, "Send to Graveyard" → both
//                   move (one Command_MoveCard + ListOfCardsToMove).
//
// Uses a 1-seat game (no opponent needed for own tap / own-graveyard move),
// matching graveyard-moves.spec.ts.

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('bulk tap and bulk move act on every selected battlefield card', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();

  try {
    const page = await ctx.newPage();
    const session = await registerAndJoinFirstRoom(page);

    const gameDescription = `bulk-${randomSuffix()}`;
    await session.rooms.createGame(gameDescription, { maxPlayers: 1 });
    const game = new GamePage(page);
    await game.loadDeck(DECK_PATH);
    await game.setReady();
    await game.waitForBoard();

    // Two cards onto the battlefield: draw 2, play each from hand.
    await game.drawCard();
    await game.drawCard();
    await game.playCardFromHand('Forest');
    await game.playCardFromHand('Forest');
    await expect(game.cardsOnBoard()).toHaveCount(2);

    // 1. Bulk tap: select both, then double-click one — the double-click on a
    //    ≥2 selection taps the whole TABLE subset (batched SetCardAttr).
    await game.boxSelectBattlefield();
    await game.cardsOnBoard().first().dblclick();
    await expect(game.cardsOnBoard().nth(0)).toHaveClass(/card-slot--tapped/);
    await expect(game.cardsOnBoard().nth(1)).toHaveClass(/card-slot--tapped/);

    // 2. Bulk move: re-select (don't rely on the tap preserving selection), then
    //    "Send to Graveyard" on a selected card → both move in one MoveCard.
    await game.boxSelectBattlefield();
    await game.moveViaCardMenu(game.cardsOnBoard().first(), /send to graveyard/i);
    await expect.poll(() => game.zoneStackCount('grave')).toBe(2);
    await expect(game.cardsOnBoard()).toHaveCount(0);

    await game.leaveGame();
  } finally {
    await ctx.close();
  }
});
