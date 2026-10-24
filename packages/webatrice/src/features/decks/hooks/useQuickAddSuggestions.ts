import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { searchCards, type SearchResult } from '../search';

export const SUGGESTION_DEBOUNCE_MS = 220;
export const MAX_SUGGESTIONS = 8;

export interface QuickAddSuggestions {
  suggestions: SearchResult[];
  loading: boolean;
  highlight: number;
  setHighlight: Dispatch<SetStateAction<number>>;
  clear: () => void;
}

export function useQuickAddSuggestions(query: string): QuickAddSuggestions {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const timerRef = useRef<number | null>(null);
  const queryTokenRef = useRef(0);

  useEffect(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
    if (query.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      setHighlight(-1);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const token = ++queryTokenRef.current;
      searchCards(query, MAX_SUGGESTIONS, controller.signal)
        .then((rows) => {
          if (controller.signal.aborted || token !== queryTokenRef.current) {
            return;
          }
          setSuggestions(rows);
          setLoading(false);
          setHighlight(rows.length ? 0 : -1);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error as { name?: string })?.name === 'AbortError'
            || token !== queryTokenRef.current) {
            return;
          }
          setSuggestions([]);
          setLoading(false);
          setHighlight(-1);
        });
    }, SUGGESTION_DEBOUNCE_MS);
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      controller.abort();
    };
  }, [query]);

  const clear = () => {
    setSuggestions([]);
    setHighlight(-1);
  };

  return { suggestions, loading, highlight, setHighlight, clear };
}
