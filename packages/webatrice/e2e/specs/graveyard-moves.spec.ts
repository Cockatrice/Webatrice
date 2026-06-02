import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';
import { dragTo, movePopupTo } from '../fixtures/dnd';

// Single-player flow exercising graveyard moves across both interaction surfaces
// (board + popups) against real Servatrice. Seed three cards into the graveyard,
// then:
//   1. grave → battlefield : drag a card OUT of the Graveyard popup.
//   2. grave → hand        : right-click a Graveyard-popup card → "Send to Hand".
//   3. grave → exile (board): drag a Graveyard-popup card onto the Exile stack.
//   4. grave → exile (popup): drag the battlefield card INTO the open Exile popup.
//
// NOTE: uses a 1-seat game. If Servatrice won't start a single-player game,
// fall back to seating a second (idle) player and have only the host act.

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('graveyard moves to battlefield, hand, and exile (board + popup)', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();

  try {
    const page = await ctx.newPage();
    const session = await registerAndJoinFirstRoom(page);

    const gameDescription = `grave-${randomSuffix()}`;
    await session.rooms.createGame(gameDescription, { maxPlayers: 1 });
    const game = new GamePage(page);
    await game.loadDeck(DECK_PATH);
    await game.setReady();
    await game.waitForBoard();

    // Seed three cards into the graveyard: draw 3, then send each to graveyard.
    const hand = page.getByTestId('hand-zone').locator('[data-testid="card-slot"]');
    for (let i = 0; i < 3; i++) {
      await game.drawCard();
    }
    await expect(hand).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await game.moveViaCardMenu(hand.first(), /send to graveyard/i);
    }
    await expect.poll(() => game.zoneStackCount('grave')).toBe(3);

    // 1. grave → battlefield: drag a card out of the Graveyard popup.
    const grave = await game.openZoneView('grave', /graveyard/i);
    await dragTo(page, game.zoneViewCards(grave).first(), game.battlefieldRow());
    await expect(game.cardsOnBoard()).toHaveCount(1);
    await expect.poll(() => game.zoneStackCount('grave')).toBe(2);

    // 2. grave → hand: context-menu move from a Graveyard-popup card.
    await game.moveViaCardMenu(game.zoneViewCards(grave).first(), /send to hand/i);
    await expect(hand).toHaveCount(1);
    await expect.poll(() => game.zoneStackCount('grave')).toBe(1);

    // 3. grave → exile (on board): drag the last graveyard card onto the Exile stack.
    await dragTo(page, game.zoneViewCards(grave).first(), game.zoneStack('rfg'));
    await expect.poll(() => game.zoneStackCount('rfg')).toBe(1);
    await expect.poll(() => game.zoneStackCount('grave')).toBe(0);

    // Close the (now empty) Graveyard popup so it can't intercept the next drag.
    await grave.getByRole('button', { name: /close zone view/i }).click();
    await expect(grave).toBeHidden();

    // 4. grave → exile (through popup): drop the battlefield card INTO the Exile popup.
    //    The popup spawns at the top-left, over the battlefield card placed in
    //    step 1 — move it clear so the card underneath is grabbable, then drop
    //    the card onto the popup body. Collision detection is z-order aware, so
    //    a release over the popup routes into exile, not the board behind it.
    const exile = await game.openZoneView('rfg', /exile/i);
    await movePopupTo(page, exile, game.zoneViewHeader(exile), 360, 360);
    await dragTo(page, game.cardsOnBoard().first(), exile.locator('.zone-view-dialog__body'));
    await expect.poll(() => game.zoneStackCount('rfg')).toBe(2);
    await expect(game.cardsOnBoard()).toHaveCount(0);
    await expect(game.zoneViewCards(exile)).toHaveCount(2);

    await game.leaveGame();
  } finally {
    await ctx.close();
  }
});
