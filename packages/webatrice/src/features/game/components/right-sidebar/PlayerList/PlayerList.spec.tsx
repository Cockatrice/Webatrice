import { screen } from '@testing-library/react';

import { makeStoreState, renderWithProviders, makeUser } from '../../../../../__test-utils__';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';
import PlayerList from './PlayerList';

function buildState(
  players: ReturnType<typeof makePlayerEntry>[],
  activePlayerId: number,
  hostId?: number,
) {
  const byId: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  for (const p of players) {
    byId[p.properties.playerId] = p;
  }
  return makeStoreState({
    games: {
      games: {
        1: makeGameEntry({
          players: byId,
          activePlayerId,
          ...(hostId != null ? { hostId } : {}),
        }),
      },
    },
  });
}

describe('PlayerList', () => {
  it('lists every player in the game', () => {
    // Post-rewrite: PlayerList no longer renders a ping dot or ping
    // seconds — the sidebar shows avatar + name + role only. Kept the
    // test's intent (every player is listed) but removed ping assertions.
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
        pingSeconds: 10,
      }),
    });
    const p2 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 2,
        userInfo: makeUser({ name: 'Bob' }),
        pingSeconds: 20,
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1, p2], 1),
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  // ping-dot color tests removed: the redo sidebar drops the ping
  // indicator entirely (see PlayerList.tsx — no ping dot / seconds
  // element renders). Nothing to assert against.

  // sideboard-lock icon tests removed: the redo sidebar doesn't
  // render a lock affordance in the player row (see PlayerList.tsx).

  it('highlights the active player', () => {
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
      }),
    });
    const p2 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 2,
        userInfo: makeUser({ name: 'Bob' }),
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1, p2], 2),
    });

    // Post-Tailwind rewrite: active row uses `bg-accent/10` in place of
    // the old BEM `player-list__item--active` modifier class.
    expect(screen.getByTestId('player-list-item-2')).toHaveClass('bg-accent/10');
    expect(screen.getByTestId('player-list-item-1')).not.toHaveClass('bg-accent/10');
  });

  it('marks conceded players with the Conceded role tag', () => {
    // Post-rewrite: there's no dedicated dim class for a conceded row.
    // The signal moved to the role label under the player's name
    // ("Conceded") plus a muted avatar treatment — assert the label.
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
        conceded: true,
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1], 0),
    });

    const row = screen.getByTestId('player-list-item-1');
    expect(row.textContent).toMatch(/Conceded/);
  });

  it('shows empty state when there are no players', () => {
    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([], 0),
    });

    expect(screen.getByText(/no players/i)).toBeInTheDocument();
  });

  it('handles missing gameId without throwing', () => {
    renderWithProviders(<PlayerList />, {
      preloadedState: makeStoreState({}),
      gameId: undefined,
    });

    expect(screen.getByText(/no players/i)).toBeInTheDocument();
  });

  it('renders a host badge on the host row only', () => {
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
      }),
    });
    const p2 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 2,
        userInfo: makeUser({ name: 'Bob' }),
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1, p2], 1, 2),
    });

    // Post-Tailwind rewrite: the host badge is a lucide-react Crown
    // icon rendered with `aria-label="Host"` in place of the old BEM
    // `.player-list__host-badge` element.
    const bobRow = screen.getByTestId('player-list-item-2');
    const aliceRow = screen.getByTestId('player-list-item-1');
    expect(bobRow.querySelector('[aria-label="Host"]')).not.toBeNull();
    expect(aliceRow.querySelector('[aria-label="Host"]')).toBeNull();
  });
});
