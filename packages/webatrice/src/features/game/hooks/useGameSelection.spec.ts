import { act, renderHook } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { useGameSelection } from './useGameSelection';

describe('useGameSelection', () => {
  describe('collapseUnlessSelected', () => {
    it('replaces the selection with just this card when it is not selected', () => {
      const { result } = renderHook(() => useGameSelection());
      const card = makeCard({ id: 5 });

      act(() => {
        result.current.collapseUnlessSelected(1, 'table', card);
      });

      expect([...result.current.selectedCardKeys]).toEqual([makeCardKey(1, 'table', 5)]);
      expect(result.current.focused?.key).toBe(makeCardKey(1, 'table', 5));
    });

    it('preserves the selection and re-points focus when the card is already selected', () => {
      const { result } = renderHook(() => useGameSelection());
      const b = makeCard({ id: 6 });
      const multi = new Set([makeCardKey(1, 'table', 5), makeCardKey(1, 'table', 6)]);

      act(() => {
        result.current.setSelectedCardKeys(multi);
      });

      act(() => {
        result.current.collapseUnlessSelected(1, 'table', b);
      });

      // Selection unchanged, focus re-points to the acted card.
      expect([...result.current.selectedCardKeys].sort()).toEqual([...multi].sort());
      expect(result.current.focused?.key).toBe(makeCardKey(1, 'table', 6));
      expect(result.current.focused?.card).toBe(b);
    });

    it('no-ops when owner or zone is missing', () => {
      const { result } = renderHook(() => useGameSelection());
      act(() => {
        result.current.collapseUnlessSelected(undefined, 'table', makeCard({ id: 5 }));
      });
      expect(result.current.selectedCardKeys.size).toBe(0);
      expect(result.current.focused).toBeNull();
    });
  });

  describe('focus/blur', () => {
    it('sets focused on focus and defers blur so a sibling focus wins', async () => {
      const { result } = renderHook(() => useGameSelection());
      const a = makeCard({ id: 5 });
      const b = makeCard({ id: 6 });

      act(() => {
        result.current.onCardFocus(1, 'table', a);
      });
      expect(result.current.focused?.key).toBe(makeCardKey(1, 'table', 5));

      // Blur A then immediately focus B (the real DOM order): B must win.
      // async act flushes the queueMicrotask-deferred blur.
      await act(async () => {
        result.current.onCardBlur(1, 'table', a);
        result.current.onCardFocus(1, 'table', b);
      });
      expect(result.current.focused?.key).toBe(makeCardKey(1, 'table', 6));
    });

    it('clears focus when the blurred card is still the focused one', async () => {
      const { result } = renderHook(() => useGameSelection());
      const a = makeCard({ id: 5 });

      act(() => {
        result.current.onCardFocus(1, 'table', a);
      });
      await act(async () => {
        result.current.onCardBlur(1, 'table', a);
      });
      expect(result.current.focused).toBeNull();
    });
  });

  it('clearSelection and clearFocused reset their respective state', () => {
    const { result } = renderHook(() => useGameSelection());

    act(() => {
      result.current.collapseUnlessSelected(1, 'table', makeCard({ id: 5 }));
    });
    expect(result.current.selectedCardKeys.size).toBe(1);
    expect(result.current.focused).not.toBeNull();

    act(() => {
      result.current.clearSelection();
      result.current.clearFocused();
    });
    expect(result.current.selectedCardKeys.size).toBe(0);
    expect(result.current.focused).toBeNull();
  });
});
