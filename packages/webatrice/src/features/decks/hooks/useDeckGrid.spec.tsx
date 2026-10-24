import { act, renderHook } from '@testing-library/react';

import type { DeckSummary } from '../deckSummary';
import type { FlatDeck } from '../deckTree';
import { readStoredSort, SORT_STORAGE_KEY, useDeckGrid } from './useDeckGrid';

const deck = (id: number, name: string, extra: Partial<FlatDeck> = {}): FlatDeck => ({
  id, name, path: '', creationTime: id, visibility: 'private', ...extra,
});
const decks = [deck(1, 'Burn', { colorIdentity: 'R' }), deck(2, 'Atraxa', { colorIdentity: 'WUBG' }), deck(3, 'Elves')];

beforeEach(() => window.localStorage.clear());

function setup(summaries: ReadonlyMap<number, DeckSummary> = new Map()) {
  return renderHook(({ s }) => useDeckGrid(decks, s), { initialProps: { s: summaries } });
}

it('shows every deck newest first and remembers the chosen sort', () => {
  const hook = setup();
  expect(hook.result.current.tiles.map((v) => v.deck.name)).toEqual(['Elves', 'Atraxa', 'Burn']);
  act(() => hook.result.current.setSort('nameAsc'));
  expect(hook.result.current.tiles.map((v) => v.deck.name)).toEqual(['Atraxa', 'Burn', 'Elves']);
  expect(window.localStorage.getItem(SORT_STORAGE_KEY)).toBe('nameAsc');
  expect(readStoredSort()).toBe('nameAsc');
});

it('ignores an unknown stored sort', () => {
  window.localStorage.setItem(SORT_STORAGE_KEY, 'lastPlayed');
  expect(readStoredSort()).toBe('newest');
});

it('filters as downloads arrive, counting the decks still pending', () => {
  const hook = setup();
  act(() => hook.result.current.setFilters({ format: 'modern' }));
  expect(hook.result.current).toMatchObject({ tiles: [], pending: 3, filtered: true, total: 3 });
  hook.rerender({ s: new Map([[1, { format: 'Modern' }], [2, { format: 'commander' }]]) });
  expect(hook.result.current.tiles.map((v) => v.deck.name)).toEqual(['Burn']);
  expect(hook.result.current.pending).toBe(1);
  expect(hook.result.current.options.formats).toEqual(['commander', 'modern']);
  act(() => hook.result.current.clearFilters());
  expect(hook.result.current).toMatchObject({ pending: 0, filtered: false });
  expect(hook.result.current.tiles).toHaveLength(3);
});

it('combines a colour filter with search', () => {
  const hook = setup();
  act(() => hook.result.current.setFilters({ colours: ['R'], colourMode: 'atMost' }));
  expect(hook.result.current.tiles.map((v) => v.deck.name)).toEqual(['Burn']);
  act(() => hook.result.current.setFilters({ query: 'zzz' }));
  expect(hook.result.current.tiles).toEqual([]);
});
