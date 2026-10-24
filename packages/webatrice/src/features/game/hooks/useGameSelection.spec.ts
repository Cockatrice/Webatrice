import { act, renderHook } from '@testing-library/react';

import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { useGameSelection } from './useGameSelection';

describe('useGameSelection', () => {
  it('holds the selection as card keys, and clearSelection empties it', () => {
    const { result } = renderHook(() => useGameSelection());

    act(() => {
      result.current.setSelectedCardKeys(new Set([makeCardKey(1, 'table', 5)]));
    });
    expect([...result.current.selectedCardKeys]).toEqual([makeCardKey(1, 'table', 5)]);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedCardKeys.size).toBe(0);
  });

  it('Escape clears the selection, unless a MUI dialog owns the key', () => {
    const key = makeCardKey(1, 'table', 5);
    const { result } = renderHook(() => useGameSelection());
    act(() => result.current.setSelectedCardKeys(new Set([key])));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selectedCardKeys.size).toBe(0);

    const dialog = document.createElement('div');
    dialog.className = 'MuiDialog-root';
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    act(() => result.current.setSelectedCardKeys(new Set([key])));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selectedCardKeys.size).toBe(1);
    dialog.remove();
  });
});
