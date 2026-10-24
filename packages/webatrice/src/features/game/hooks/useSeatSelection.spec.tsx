import { act, renderHook } from '@testing-library/react';
import { useState, type ReactNode } from 'react';

import { GameSelectionProvider } from '../components/ui/GameSelectionContext';
import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { useSeatSelection, type SeatSelectableCards } from './useSeatSelection';

const SEAT_ONE: SeatSelectableCards = {
  hand: [{ id: '30' }],
  battlefield: [{ id: '10' }, { id: '11' }, { id: '99', ownerPlayerId: 3 }],
  stack: [],
};
const SEAT_TWO: SeatSelectableCards = { hand: [], battlefield: [{ id: '20' }], stack: [] };

function renderSeats(initial: ReadonlySet<string> = new Set()) {
  const game = { keys: initial, renders: 0 };
  function Provider({ children }: { children: ReactNode }) {
    const [keys, setKeys] = useState(initial);
    game.keys = keys;
    return (
      <GameSelectionProvider selectedCardKeys={keys} setSelectedCardKeys={setKeys}>
        {children}
      </GameSelectionProvider>
    );
  }
  const { result } = renderHook(
    () => {
      game.renders += 1;
      return { one: useSeatSelection(1, SEAT_ONE), two: useSeatSelection(2, SEAT_TWO) };
    },
    { wrapper: Provider },
  );
  return { result, game };
}

describe('useSeatSelection', () => {
  it('reuses the published set only when its keys and order are unchanged', () => {
    const firstKey = makeCardKey(1, 'table', 10);
    const secondKey = makeCardKey(3, 'table', 99);
    const initial = new Set([firstKey, secondKey]);
    const { result, game } = renderSeats(initial);
    const rendersBeforeSameSelection = game.renders;

    act(() => result.current.one.setSelection({ zone: 'battlefield', ids: new Set(['10', '99']) }));

    expect(game.keys).toBe(initial);
    expect(game.renders).toBe(rendersBeforeSameSelection);

    act(() => result.current.one.setSelection({ zone: 'battlefield', ids: new Set(['99', '10']) }));

    expect(game.keys).not.toBe(initial);
    expect([...game.keys]).toEqual([secondKey, firstKey]);
    expect(game.renders).toBeGreaterThan(rendersBeforeSameSelection);
  });

  it('writes game keys with each card\'s real owner and wire zone', () => {
    const { result, game } = renderSeats();

    act(() => result.current.one.setSelection({ zone: 'battlefield', ids: new Set(['10', '99']) }));

    expect([...game.keys].sort()).toEqual([makeCardKey(1, 'table', 10), makeCardKey(3, 'table', 99)].sort());
    expect(result.current.one.selection).toEqual({ zone: 'battlefield', ids: new Set(['10', '99']) });
    expect(result.current.two.selection).toBeNull();
  });

  it('replaces another seat\'s selection, and clearing one seat leaves the others', () => {
    const { result, game } = renderSeats();

    act(() => result.current.one.setSelection({ zone: 'hand', ids: new Set(['30']) }));
    act(() => result.current.two.setSelection({ zone: 'battlefield', ids: new Set(['20']) }));
    expect(result.current.one.selection).toBeNull();
    expect(result.current.two.selection).toEqual({ zone: 'battlefield', ids: new Set(['20']) });

    act(() => result.current.one.setSelection(null));
    expect([...game.keys]).toEqual([makeCardKey(2, 'table', 20)]);

    act(() => result.current.one.clearAllSelection());
    expect(game.keys.size).toBe(0);
  });

  it('ignores keys for cards the seat no longer shows', () => {
    const { result } = renderSeats(new Set([makeCardKey(1, 'table', 404)]));
    expect(result.current.one.selection).toBeNull();
  });

  it('keeps a selection of its own outside a game', () => {
    const { result } = renderHook(() => useSeatSelection(1, SEAT_ONE));

    act(() => result.current.setSelection({ zone: 'stack', ids: new Set() }));
    expect(result.current.selection).toBeNull();
    act(() => result.current.setSelection({ zone: 'hand', ids: new Set(['30']) }));
    expect(result.current.selection).toEqual({ zone: 'hand', ids: new Set(['30']) });
  });
});
