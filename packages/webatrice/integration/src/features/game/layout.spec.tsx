import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { store } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

// PlayerBox rewrite removed the `data-testid="player-board-N"` marker. The
// current DOM identifies each seated cell via `.game__board-cell` containing
// `[data-arrow-target-player-id="N"]` (the life-total anchor). Helper mirrors
// the previous test intent while staying attached to markers PlayerBox still
// emits.
function findBoardCell(playerId: number): HTMLElement | null {
  const anchor = document.querySelector(`[data-arrow-target-player-id="${playerId}"]`);
  return anchor ? (anchor.closest('.game__board-cell') as HTMLElement | null) : null;
}

function expectBoardCell(playerId: number): HTMLElement {
  const cell = findBoardCell(playerId);
  expect(cell, `expected cell for player ${playerId}`).not.toBeNull();
  return cell!;
}

describe('Game board layout', () => {
  it('renders every seated player board as players join', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(findBoardCell(1)).not.toBeNull();
    });

    // All seated players render at once: the local board plus each opponent.
    expect(findBoardCell(2)).not.toBeNull();

    act(() => {
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2, 3], 1), }));
    });

    await waitFor(() => {
      // A third player adds a third board (the single-column 3-stack).
      expect(findBoardCell(3)).not.toBeNull();
    });
    expect(findBoardCell(1)).not.toBeNull();
    expect(findBoardCell(2)).not.toBeNull();
  });

  it('renders only the local board when no opponent has joined yet', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1], 1), }));
    });

    await waitFor(() => {
      expect(findBoardCell(1)).not.toBeNull();
    });
    // A lone player gets the whole board to themselves: no second cell.
    expect(findBoardCell(2)).toBeNull();

    act(() => {
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(findBoardCell(2)).not.toBeNull();
    });
  });

  it('mirrors the opponent board and leaves the local board upright', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(findBoardCell(2)).not.toBeNull();
    });

    // Mirroring is now expressed via `game__board-cell--mirrored`; the
    // legacy `player-board--mirrored` class shipped with the removed
    // PlayerBoard component.
    expect(expectBoardCell(2)).toHaveClass('game__board-cell--mirrored');
    expect(expectBoardCell(1)).not.toHaveClass('game__board-cell--mirrored');
  });

  // Removed: `renders the deck/graveyard/exile zones inside the info panel in
  // desktop order` — PlayerInfoPanel's `.player-info-panel__zones` /
  // `.zone-stack__label` DOM was superseded by the PlayerBox rewrite, which
  // renders deck/graveyard/exile as its own zone pile widgets without a
  // labeled rail. There is no direct successor structure to assert against.
});
