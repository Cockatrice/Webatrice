import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toBcp47 } from '@app/utils';

import {
  DECK_GRID_SORTS,
  deckFilterOptions,
  deckTileView,
  filterDeckViews,
  hasDeckFilters,
  NO_DECK_FILTERS,
  sortDeckViews,
  type DeckFilterOptions,
  type DeckGridFilters,
  type DeckGridSort,
  type DeckTileView,
} from '../deckGrid';
import type { DeckSummary } from '../deckSummary';
import type { FlatDeck } from '../deckTree';

export const SORT_STORAGE_KEY = 'decks:sort';

export function readStoredSort(): DeckGridSort {
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (raw && (DECK_GRID_SORTS as readonly string[]).includes(raw)) {
      return raw as DeckGridSort;
    }
  } catch {
    return 'newest';
  }
  return 'newest';
}

export interface UseDeckGrid {
  tiles: DeckTileView[];
  pending: number;
  total: number;
  filtered: boolean;
  options: DeckFilterOptions;
  filters: DeckGridFilters;
  setFilters: (patch: Partial<DeckGridFilters>) => void;
  clearFilters: () => void;
  sort: DeckGridSort;
  setSort: (sort: DeckGridSort) => void;
}

export function useDeckGrid(decks: readonly FlatDeck[], summaries: ReadonlyMap<number, DeckSummary>): UseDeckGrid {
  const { i18n } = useTranslation();
  const [filters, setFilterState] = useState<DeckGridFilters>(NO_DECK_FILTERS);
  const [sort, setSort] = useState<DeckGridSort>(readStoredSort);

  useEffect(() => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sort);
    } catch {
      return;
    }
  }, [sort]);

  const views = useMemo(() => decks.map((deck) => deckTileView(deck, summaries.get(deck.id))), [decks, summaries]);
  const options = useMemo(() => deckFilterOptions(views, filters), [views, filters]);
  const locale = toBcp47(i18n.language);
  const { tiles, pending } = useMemo(() => {
    const { shown, pending: waiting } = filterDeckViews(views, filters);
    return { tiles: sortDeckViews(shown, sort, locale || undefined), pending: waiting };
  }, [views, filters, sort, locale]);

  return {
    tiles,
    pending,
    total: views.length,
    filtered: hasDeckFilters(filters),
    options,
    filters,
    setFilters: (patch) => setFilterState((prev) => ({ ...prev, ...patch })),
    clearFilters: () => setFilterState(NO_DECK_FILTERS),
    sort,
    setSort,
  };
}
