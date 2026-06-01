import { act, waitFor, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { store } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

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

    expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    expect(screen.getByTestId('player-board-2')).toBeInTheDocument();
    expect(screen.getByTestId('hand-zone')).toBeInTheDocument();
  });

  it('returns to the empty placeholder when gameLeft fires', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    });

    act(() => {
      store.dispatch(games.Actions.gameLeft({ gameId: 42 }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('game-empty')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('player-board-1')).not.toBeInTheDocument();
  });
});
