import { useCallback, useRef, useState } from 'react';

import {
  EMPTY_DECK_HISTORY,
  recordDeckEdit,
  redoDeck,
  undoDeck,
  type DeckHistory,
  type DeckHistoryReason,
} from '../deckHistory';
import type { HydratedDeck } from '../types';

export interface UseDeckHistory {
  history: DeckHistory;
  canUndo: boolean;
  canRedo: boolean;
  record: (before: HydratedDeck, reason: DeckHistoryReason, coalesceMs?: number) => void;
  undo: (current: HydratedDeck, steps?: number) => HydratedDeck | null;
  redo: (current: HydratedDeck, steps?: number) => HydratedDeck | null;
  clear: () => void;
}

export function useDeckHistory(now: () => number = Date.now): UseDeckHistory {
  const [history, setHistory] = useState<DeckHistory>(EMPTY_DECK_HISTORY);
  const historyRef = useRef(history);

  const commit = useCallback((next: DeckHistory) => {
    historyRef.current = next;
    setHistory(next);
  }, []);

  const record = useCallback(
    (before: HydratedDeck, reason: DeckHistoryReason, coalesceMs?: number) => {
      commit(recordDeckEdit(historyRef.current, before, reason, { now: now(), coalesceMs }));
    },
    [commit, now],
  );

  const undo = useCallback(
    (current: HydratedDeck, steps = 1) => {
      const step = undoDeck(historyRef.current, current, steps);
      if (!step) {
        return null;
      }
      commit(step.history);
      return step.deck;
    },
    [commit],
  );

  const redo = useCallback(
    (current: HydratedDeck, steps = 1) => {
      const step = redoDeck(historyRef.current, current, steps);
      if (!step) {
        return null;
      }
      commit(step.history);
      return step.deck;
    },
    [commit],
  );

  const clear = useCallback(() => commit(EMPTY_DECK_HISTORY), [commit]);

  return {
    history,
    canUndo: history.undo.length > 0,
    canRedo: history.redo.length > 0,
    record,
    undo,
    redo,
    clear,
  };
}
