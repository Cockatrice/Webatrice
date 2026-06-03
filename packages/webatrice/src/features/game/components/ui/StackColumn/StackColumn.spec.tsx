import { screen, fireEvent } from '@testing-library/react';
import { Enriched } from '@cockatrice/datatrice';
vi.mock('../../../../../hooks/useSettings');
vi.mock('../../../hooks/useScryfallCard', () => ({
  useScryfallCard: () => ({ smallUrl: null, normalUrl: null, isLoading: false }),
}));

import { makeStoreState, renderWithProviders, makeUser } from '../../../../../__test-utils__';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import StackColumn from './StackColumn';

function stateWithStack(cards: ReturnType<typeof makeCard>[] = []) {
  const stack = makeZoneEntry({
    name: Enriched.ZoneName.STACK,
    cards,
    cardCount: cards.length,
  });
  const player = makePlayerEntry({
    properties: makePlayerProperties({
      playerId: 1,
      userInfo: makeUser({ name: 'Alice' }),
    }),
    zones: { [Enriched.ZoneName.STACK]: stack },
  });
  return makeStoreState({
    games: { games: { 1: makeGameEntry({ localPlayerId: 1, players: { 1: player } }) } },
  });
}

describe('StackColumn', () => {
  it('renders an empty cards container when the stack is empty', () => {
    renderWithProviders(<StackColumn />, {
      preloadedState: stateWithStack([]),
    });

    expect(screen.getByTestId('stack-column-1')).toBeInTheDocument();
    expect(screen.queryAllByTestId('card-slot')).toHaveLength(0);
  });

  it('renders a CardSlot per card on the stack', () => {
    renderWithProviders(<StackColumn />, {
      preloadedState: stateWithStack([
        makeCard({ id: 1, name: 'Lightning Bolt' }),
        makeCard({ id: 2, name: 'Counterspell' }),
      ]),
    });

    expect(screen.getAllByTestId('card-slot')).toHaveLength(2);
  });

  it('fires onCardContextMenu when right-clicking a stack card', () => {
    const onCardContextMenu = vi.fn();
    renderWithProviders(<StackColumn />, {
      preloadedState: stateWithStack([makeCard({ id: 7, name: 'Lightning Bolt' })]),
      gameInteraction: { onCardContextMenu },
    });

    fireEvent.contextMenu(screen.getByTestId('card-slot'));

    expect(onCardContextMenu).toHaveBeenCalled();
    const [ownerPlayerId, zoneName] = onCardContextMenu.mock.calls[0];
    expect(ownerPlayerId).toBe(1);
    expect(zoneName).toBe(Enriched.ZoneName.STACK);
  });
});
