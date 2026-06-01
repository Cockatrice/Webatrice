import { act, waitFor, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { store } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

describe('Game board layout', () => {
  it('renders every seated player board as players join', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    });

    // All seated players render at once: the local board plus each opponent.
    expect(screen.getByTestId('player-board-2')).toBeInTheDocument();

    act(() => {
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2, 3], 1), }));
    });

    await waitFor(() => {
      // A third player adds a third board (the single-column 3-stack).
      expect(screen.getByTestId('player-board-3')).toBeInTheDocument();
    });
    expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    expect(screen.getByTestId('player-board-2')).toBeInTheDocument();
  });

  it('renders only the local board when no opponent has joined yet', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    });
    // A lone player gets the whole board to themselves: no second cell.
    expect(screen.queryByTestId('player-board-2')).not.toBeInTheDocument();

    act(() => {
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-2')).toBeInTheDocument();
    });
  });

  it('mirrors the opponent board and leaves the local board upright', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-2')).toHaveClass('player-board--mirrored');
    });

    expect(screen.getByTestId('player-board-1')).not.toHaveClass('player-board--mirrored');
  });

  it('renders the deck/graveyard/exile zones inside the info panel in desktop order', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-board-1')).toBeInTheDocument();
    });

    const localBoard = screen.getByTestId('player-board-1');
    const zones = localBoard.querySelector('.player-info-panel__zones')!;
    const labels = Array.from(zones.querySelectorAll('.zone-stack__label')).map(
      (n) => n.textContent,
    );
    expect(labels).toEqual(['Deck', 'Hand', 'Graveyard', 'Exile']);
    // Stack is now its own column, not a zone inside the rail.
    expect(within(zones as HTMLElement).queryByText('Stack')).not.toBeInTheDocument();
    expect(within(localBoard).getByTestId('stack-column-1')).toBeInTheDocument();
  });
});
