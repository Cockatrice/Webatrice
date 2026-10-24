import { act, renderHook } from '@testing-library/react';

import type { HydratedDeck } from '../types';
import { useDeckHistory } from './useDeckHistory';

function deck(name: string): HydratedDeck {
  return { name, meta: { v: 1, updatedAt: 'x' }, cards: [], format: 'modern' };
}

describe('useDeckHistory', () => {
  it('records edits and undoes/redoes them, exposing what is possible', () => {
    const { result } = renderHook(() => useDeckHistory());
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.record(deck('A'), { kind: 'tags' }));
    expect(result.current.canUndo).toBe(true);

    let restored: HydratedDeck | null = null;
    act(() => {
      restored = result.current.undo(deck('B'));
    });
    expect(restored!.name).toBe('A');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      restored = result.current.redo(deck('A'));
    });
    expect(restored!.name).toBe('B');
    expect(result.current.redo(deck('B'))).toBeNull();
  });

  it('builds on the previous edit within one event', () => {
    const { result } = renderHook(() => useDeckHistory());
    act(() => {
      result.current.record(deck('A'), { kind: 'tags' });
      result.current.record(deck('B'), { kind: 'tags' });
    });
    expect(result.current.history.undo.map((m) => m.deck.name)).toEqual(['A', 'B']);
  });

  it('merges a typing burst using the injected clock, and clears', () => {
    let now = 0;
    const { result } = renderHook(() => useDeckHistory(() => now));
    act(() => result.current.record(deck('A'), { kind: 'rename', from: 'A', to: 'Ab' }, 300));
    now = 100;
    act(() => result.current.record(deck('Ab'), { kind: 'rename', from: 'Ab', to: 'Abc' }, 300));
    expect(result.current.history.undo).toHaveLength(1);

    act(() => result.current.clear());
    expect(result.current.canUndo).toBe(false);
  });
});
