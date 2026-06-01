import { act, waitFor, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { store } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { LocationProbe, buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

describe('Game end navigation', () => {
  it('navigates to /server when the local user is kicked', async () => {
    renderFeatureScreen(
      <>
        <Game />
        <LocationProbe />
      </>,
    );

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    });

    act(() => {
      store.dispatch(games.Actions.kicked({ gameId: 42 }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('app-location')).toHaveTextContent('/server');
    });
  });

  it('navigates to /server when the game is closed by the host', async () => {
    renderFeatureScreen(
      <>
        <Game />
        <LocationProbe />
      </>,
    );

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    });

    act(() => {
      store.dispatch(games.Actions.gameClosed({ gameId: 42 }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('app-location')).toHaveTextContent('/server');
    });
  });
});
