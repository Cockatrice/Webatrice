import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_SAMPLE_HAND_SIZE, clampHandSize, drawSampleHand, sampleLibrary } from '../sampleHand';
import type { DeckCard } from '../types';

export const SAMPLE_HAND_SIZE_STORAGE_KEY = 'decks:sampleHandSize';

function readStoredSize(): number {
  try {
    const raw = window.localStorage.getItem(SAMPLE_HAND_SIZE_STORAGE_KEY);
    if (raw != null) {
      return clampHandSize(Number(raw));
    }
  } catch {
    // Storage disabled — fall through.
  }
  return DEFAULT_SAMPLE_HAND_SIZE;
}

export interface UseSampleHand {
  hand: DeckCard[];
  size: number;
  librarySize: number;
  setSize: (size: number) => void;
  redraw: () => void;
}

export function useSampleHand(cards: readonly DeckCard[], random: () => number = Math.random): UseSampleHand {
  const [size, setSizeState] = useState(readStoredSize);
  const library = useMemo(() => sampleLibrary(cards), [cards]);
  const [hand, setHand] = useState<DeckCard[]>(() => drawSampleHand(library, size, random));

  const redraw = useCallback(() => setHand(drawSampleHand(library, size, random)), [library, size, random]);

  const setSize = useCallback((next: number) => {
    const clamped = clampHandSize(next);
    setSizeState(clamped);
    setHand(drawSampleHand(library, clamped, random));
  }, [library, random]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAMPLE_HAND_SIZE_STORAGE_KEY, String(size));
    } catch {
      // Storage disabled — the size still holds for this session.
    }
  }, [size]);

  return { hand, size, librarySize: library.length, setSize, redraw };
}
