import { act, waitFor, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { store } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

// PlayerBox rewrite dropped the `player-board-N` / `hand-zone` testids that
// this spec used to key on. The current DOM identifies each seated cell via a
// `.game__board-cell` containing `[data-arrow-target-player-id="N"]` (the
// life-total anchor). The hand assertion is dropped — the hand is now baked
// into PlayerBox and no longer has a dedicated testid.
function findBoardCell(playerId: number): HTMLElement | null {
  const anchor = document.querySelector(`[data-arrow-target-player-id="${playerId}"]`);
  return anchor ? (anchor.closest('.game__board-cell') as HTMLElement | null) : null;
}

describe('Game lifecycle', () => {
  it('renders the empty-board placeholder until a game is joined', () => {
    renderFeatureScreen(<Game />);

    expect(screen.getByTestId('game-empty')).toBeInTheDocument();
    expect(screen.getByTestId('phase-bar')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  it('transitions from empty → active board when gameJoined + gameStateChanged fire', async () => {
    renderFeatureScreen(<Game />);

    expect(screen.getByTestId('game-empty')).toBeInTheDocument();

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('game-empty')).not.toBeInTheDocument();
    });

    expect(findBoardCell(1)).not.toBeNull();
    expect(findBoardCell(2)).not.toBeNull();
  });

  it('returns to the empty placeholder when gameLeft fires', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(findBoardCell(1)).not.toBeNull();
    });

    act(() => {
      store.dispatch(games.Actions.gameLeft({ gameId: 42 }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('game-empty')).toBeInTheDocument();
    });

    expect(findBoardCell(1)).toBeNull();
  });
});
