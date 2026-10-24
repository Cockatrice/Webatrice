
import { act, fireEvent, screen } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { buildSeatGameState, cardEl, chooseMenuPath, openContextMenu, type SeatGameSpec } from './__test-utils__/seatFixtures';
import Game from './Game';

const seatRenders = vi.hoisted(() => new Map<number, number>());

vi.mock('./components/ui/PlayerBoard/usePlayerSeat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/ui/PlayerBoard/usePlayerSeat')>();
  return {
    ...actual,
    usePlayerSeat: (props: Parameters<typeof actual.usePlayerSeat>[0]) => {
      const { playerId } = props.model.seat;
      seatRenders.set(playerId, (seatRenders.get(playerId) ?? 0) + 1);
      return actual.usePlayerSeat(props);
    },
  };
});

vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/catalog/lookup', () => {
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCards: vi.fn(async (inputs: Array<string | { name: string }>) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, unknown(name)];
      }))),
    lookupCardsCached: vi.fn(async (names: string[]) => new Map(names.map((n) => [n, unknown(n)]))),
    fetchAllPrintings: vi.fn(async () => []),
  };
});

const OGRE = makeCard({ id: 10, name: 'Ogre', x: 0, y: 0 });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });
const AURA = makeCard({ id: 40, name: 'Aura' });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, table: [OGRE], stack: [AURA], deckCount: 40 },
    { playerId: 2, table: [BEAR], deckCount: 40 },
  ],
};

describe('a pending target pick\'s pointer', () => {
  it('redraws the live arrow on a mouse move without re-rendering any seat', () => {
    renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient: createMockWebClient() });
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Draw arrow...');

    act(() => {
      fireEvent.mouseMove(window, { clientX: 300, clientY: 200 });
    });
    const arrowPath = () => screen.getByTestId('pending-target-arrows').querySelector('path')!.getAttribute('d');
    const firstPath = arrowPath();
    const rendersBefore = new Map(seatRenders);

    act(() => {
      fireEvent.mouseMove(window, { clientX: 600, clientY: 500 });
      fireEvent.mouseMove(window, { clientX: 700, clientY: 520 });
    });

    expect(arrowPath()).not.toBe(firstPath);
    expect(seatRenders).toEqual(rendersBefore);
    expect([...seatRenders.keys()].sort()).toEqual([1, 2]);
  });

  it('draws an attach from a stack card from that card', () => {
    renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient: createMockWebClient() });
    openContextMenu(cardEl(AURA.id, 'stack'));
    chooseMenuPath('Attach to card...');
    act(() => {
      fireEvent.mouseMove(window, { clientX: 300, clientY: 200 });
    });
    expect(screen.getByTestId('pending-target-arrows').querySelectorAll('path')).toHaveLength(1);
  });
});
