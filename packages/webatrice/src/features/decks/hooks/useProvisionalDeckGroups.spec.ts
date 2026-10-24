import { renderHook } from '@testing-library/react';
import { useProvisionalDeckGroups } from './useProvisionalDeckGroups';
import type { DeckCard } from '../types';

it('groups only file sections and sorts names without using missing card types', () => {
  const cards: DeckCard[] = [
    { name: 'Zulu', quantity: 4, category: 'main', lookupSource: 'unknown' },
    { name: 'Leader', quantity: 1, category: 'main', isCommander: true, lookupSource: 'unknown' },
    { name: 'Side card', quantity: 2, category: 'sideboard', lookupSource: 'unknown' },
    { name: 'Alpha', quantity: 1, category: 'main', lookupSource: 'unknown' },
  ];
  const { result, rerender } = renderHook(({ rows }) => useProvisionalDeckGroups(rows), { initialProps: { rows: cards } });
  expect(result.current).toEqual([
    { label: 'Commander', indices: [1] }, { label: 'Main', indices: [3, 0] }, { label: 'Sideboard', indices: [2] },
  ]);
  rerender({ rows: [] });
  expect(result.current).toEqual([]);
});
