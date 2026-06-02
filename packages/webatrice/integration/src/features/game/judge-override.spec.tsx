import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getExtension, hasExtension } from '@bufbuild/protobuf';

import { Command_Judge_ext, Command_MoveCard_ext } from '@cockatrice/sockatrice/generated';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { store, connectRaw } from '../../helpers/setup';
import { renderFeatureScreen } from '../helpers';
import { findLastGameCommand } from '../../helpers/command-capture';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

const GAME_ID = 42;

// Seats the local user as a JUDGE (player 1) and seeds an opponent-owned card
// (player 2) on the board, so a right-click on it can drive the real menu.
async function renderJudgeBoardWithOpponentCard(): Promise<HTMLElement> {
  connectRaw();
  renderFeatureScreen(<Game />);

  act(() => {
    store.dispatch(games.Actions.gameJoined({
      data: buildEventGameJoined({ gameId: GAME_ID, localPlayerId: 1, hostId: 1, judge: true }),
    }));
    store.dispatch(games.Actions.gameStateChanged({
      gameId: GAME_ID,
      data: buildEventGameStateChanged([1, 2], 1, { tableCardsByPlayer: { 2: [{ id: 77, x: 0, y: 0 }] } }),
    }));
  });

  const board = await screen.findByTestId('player-board-2');
  return board;
}

describe('Judge override — owner-routing command shape', () => {
  it('a judge "Send to Graveyard" on an opponent card emits Command_Judge wrapping a MoveCard to the owner', async () => {
    const board = await renderJudgeBoardWithOpponentCard();
    const slot = board.querySelector('[data-card-id="77"] [data-testid="card-slot"]')
      ?? board.querySelector('[data-card-id="77"]');
    fireEvent.contextMenu(slot as HTMLElement);

    // The writeable menu is gated on canActOnCard — visible here only because the
    // local user is a judge acting on a foreign card.
    const menu = await screen.findByTestId('card-context-menu');
    fireEvent.click(within(menu).getByText('Send to Graveyard'));

    // The outbound command is wrapped: Command_Judge(target_id=owner) carrying
    // the inner MoveCard — the server then runs the move as the owner.
    const wrapped = findLastGameCommand(Command_Judge_ext);
    expect(wrapped.gameId).toBe(GAME_ID);
    expect(wrapped.value.targetId).toBe(2);

    const inner = wrapped.value.gameCommand[0];
    expect(hasExtension(inner, Command_MoveCard_ext)).toBe(true);
    const move = getExtension(inner, Command_MoveCard_ext);
    expect(move.startPlayerId).toBe(2);
    expect(move.startZone).toBe('table');
    expect(move.targetZone).toBe('grave');
    expect(move.targetPlayerId).toBe(2); // non-table routes to the owner tree
    expect(move.cardsToMove?.card[0]?.cardId).toBe(77);
  });
});
