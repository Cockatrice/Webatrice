import { useEffect, useState } from 'react';

export type DeckListViewMode = 'card' | 'compact';

export const VIEW_MODE_STORAGE_KEY = 'decks:viewMode';

export function readStoredViewMode(): DeckListViewMode {
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (raw === 'compact' || raw === 'card') {
      return raw;
    }
  } catch {
    // Storage disabled — fall through.
  }
  return 'card';
}

export function useDeckListViewMode(): [DeckListViewMode, (mode: DeckListViewMode) => void] {
  const [viewMode, setViewMode] = useState<DeckListViewMode>(readStoredViewMode);
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Storage disabled (private mode, quota, …) — the choice still
      // holds for this session.
    }
  }, [viewMode]);
  return [viewMode, setViewMode];
}
