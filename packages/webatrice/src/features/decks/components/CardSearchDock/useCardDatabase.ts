import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ScryfallSearchError,
  scryfallSearchUrl,
  searchScryfallPage,
  type ScryfallSearchCard,
  type ScryfallSearchFailure,
} from '../../search';
import { isScryfallPageUrl } from './dockModel';

export const SEARCH_DEBOUNCE_MS = 300;

export interface CardDatabase {
  results: ScryfallSearchCard[];
  total: number;
  fresh: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: ScryfallSearchFailure | null;
  hasMore: boolean;
  loadMore: () => void;
}

interface Page {
  query: string;
  cards: ScryfallSearchCard[];
  total: number;
  nextPage: string | null;
}

const EMPTY_PAGE: Page = { query: '', cards: [], total: 0, nextPage: null };

function failureOf(e: unknown): ScryfallSearchFailure {
  return e instanceof ScryfallSearchError ? e.failure : { kind: 'failed' };
}

function isAbort(e: unknown): boolean {
  return (e as { name?: string })?.name === 'AbortError';
}

export function useCardDatabase(query: string): CardDatabase {
  const q = query.trim();
  const [page, setPage] = useState<Page>(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ScryfallSearchFailure | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLoadingMore(false);
    if (!q) {
      setPage(EMPTY_PAGE);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const next = await searchScryfallPage(scryfallSearchUrl(q), controller.signal);
        if (!controller.signal.aborted) {
          setPage({ query: q, cards: next.cards, total: next.total, nextPage: next.nextPage });
        }
      } catch (e) {
        if (controller.signal.aborted || isAbort(e)) {
          return;
        }
        setPage({ ...EMPTY_PAGE, query: q });
        setError(failureOf(e));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const fresh = page.query === q;

  const loadMore = useCallback(() => {
    const controller = controllerRef.current;
    const pageQuery = page.query;
    if (!fresh || !controller || controller.signal.aborted || loadingMore || !isScryfallPageUrl(page.nextPage)) {
      return;
    }
    setLoadingMore(true);
    void searchScryfallPage(page.nextPage, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) {
          return;
        }
        setPage((prev) => (prev.query === pageQuery
          ? { ...prev, cards: [...prev.cards, ...next.cards], nextPage: next.nextPage }
          : prev));
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted && !isAbort(e)) {
          setError(failureOf(e));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingMore(false);
        }
      });
  }, [fresh, loadingMore, page.nextPage, page.query]);

  return {
    results: page.cards,
    total: page.total,
    fresh,
    loading,
    loadingMore,
    error,
    hasMore: fresh && isScryfallPageUrl(page.nextPage),
    loadMore,
  };
}
