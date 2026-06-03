import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { GamePage } from '../pages';
import { E2E_JUDGE, joinFirstRoomAs, registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

// End-to-end judge override against real Servatrice: a judge acting on another
// player's card. The judge joins as a JUDGE SPECTATOR — webatrice gives judges no
// deck-select (useDeckSelectDialog's open predicate excludes judges) and only spectators may
// join a running game, while the card context menu is gated on `canActOnCard`
// (true for judges) rather than ownership. The judge sends the host's battlefield
// card to the graveyard; the server must accept the wrapped Command_Judge and
// route the card to the OWNER's (host's) graveyard.
//
// The judge logs in as the seeded `e2e_judge` account (docker/servatrice/
// judge-seed.sql, admin = 4 → IsJudge), which is what surfaces the "Join as Judge
// Spectator" control.

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('a judge sends an opponent card to the owner\'s graveyard', async ({ browser }) => {
  test.setTimeout(180_000);
  const hostCtx = await browser.newContext();
  const judgeCtx = await browser.newContext();

  try {
    const hostPage = await hostCtx.newPage();
    const judgePage = await judgeCtx.newPage();

    // Host: a normal single-seat game, with one card played to the battlefield.
    const host = await registerAndJoinFirstRoom(hostPage);
    const gameDescription = `judge-${randomSuffix()}`;
    await host.rooms.createGame(gameDescription, { maxPlayers: 1 });

    const hostGame = new GamePage(hostPage);
    await hostGame.loadDeck(DECK_PATH);
    await hostGame.setReady();
    await hostGame.waitForBoard();

    await hostGame.drawCard();
    await hostGame.playCardFromHand('Forest');
    await expect(hostGame.cardsOnBoard()).toHaveCount(1);

    // Judge: log in as the seeded judge, join the same room, and join the running
    // game as a judge spectator.
    const judge = await joinFirstRoomAs(judgePage, E2E_JUDGE);
    await judge.rooms.joinGame(gameDescription, { judgeSpectator: true });

    const judgeGame = new GamePage(judgePage);
    await judgeGame.waitForBoard();

    // The host's card is visible on the judge's view (judges are omniscient); the
    // host is the only board, so it's the "opponent" board from the judge's seat.
    const hostCard = judgeGame.cardsOnBoard(judgeGame.opponentBoard);
    await expect(hostCard).toHaveCount(1);

    // Judge override: the writeable menu opens on a foreign card because the local
    // user is a judge. "Send to Graveyard" wraps in Command_Judge(target=host).
    await judgeGame.moveViaCardMenu(hostCard.first(), /send to graveyard/i);

    // The server applied the judge command as the owner: the card lands in the
    // HOST's graveyard, and leaves the host's battlefield.
    await expect.poll(() => hostGame.zoneStackCount('grave')).toBe(1);
    await expect(hostGame.cardsOnBoard()).toHaveCount(0);
  } finally {
    await hostCtx.close();
    await judgeCtx.close();
  }
});
