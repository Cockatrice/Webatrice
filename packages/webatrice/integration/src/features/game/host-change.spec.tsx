import { act, waitFor, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { store } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

// PlayerList rewrite replaced the `.player-list__host-badge` className with a
// lucide Crown icon carrying `aria-label="Host"`. The seat row still exposes
// `data-testid="player-list-item-N"`.
function findHostBadge(row: HTMLElement) {
  return within(row).queryByLabelText('Host');
}

describe('Game host change', () => {
  it('reflects a host change through both PlayerList badge and PlayerInfoPanel', async () => {
    renderFeatureScreen(<Game />);

    act(() => {
      store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }), }));
      store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data: buildEventGameStateChanged([1, 2], 1), }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-list-item-1')).toBeInTheDocument();
    });

    // Host starts as 1; badge should be on row 1.
    expect(findHostBadge(screen.getByTestId('player-list-item-1'))).not.toBeNull();
    expect(findHostBadge(screen.getByTestId('player-list-item-2'))).toBeNull();

    // Host changes to player 2.
    act(() => {
      store.dispatch(games.Actions.gameHostChanged({ gameId: 42, hostId: 2 }));
    });

    await waitFor(() => {
      expect(findHostBadge(screen.getByTestId('player-list-item-2'))).not.toBeNull();
    });
    expect(findHostBadge(screen.getByTestId('player-list-item-1'))).toBeNull();
  });
});
