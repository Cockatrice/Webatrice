import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { cardLookupRevision, getFormatRules, lookupCardsCached, subscribeCardLookups } from '@app/services';

import { deckLegality, legalityFacts, toFormatRules, type DeckLegality, type FormatRules, type LegalityFacts } from '../deckLegality';
import type { HydratedDeck } from '../types';

export interface UseDeckLegality extends DeckLegality {
  loading: boolean;
}

const EMPTY_FACTS: ReadonlyMap<string, LegalityFacts | undefined> = new Map();

export function useDeckLegality(deck: HydratedDeck | null): UseDeckLegality {
  const lookupRevision = useSyncExternalStore(subscribeCardLookups, cardLookupRevision);
  const format = deck?.format ?? '';
  const namesKey = useMemo(
    () => Array.from(new Set((deck?.cards ?? []).map((c) => c.name))).sort().join('\n'),
    [deck?.cards],
  );

  const [facts, setFacts] = useState<{ key: string; byName: ReadonlyMap<string, LegalityFacts | undefined> }>();
  const [rules, setRules] = useState<{ format: string; rules: FormatRules | undefined }>();

  useEffect(() => {
    if (!namesKey) {
      setFacts({ key: namesKey, byName: EMPTY_FACTS });
      return;
    }
    const controller = new AbortController();
    lookupCardsCached(namesKey.split('\n'), controller.signal, true)
      .then((lookups) => {
        if (!controller.signal.aborted) {
          const byName = new Map<string, LegalityFacts | undefined>();
          for (const [name, lookup] of lookups) {
            byName.set(name, legalityFacts(lookup));
          }
          setFacts({ key: namesKey, byName });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFacts({ key: namesKey, byName: EMPTY_FACTS });
        }
      });
    return () => {
      controller.abort();
    };
  }, [namesKey, lookupRevision]);

  useEffect(() => {
    let cancelled = false;
    getFormatRules(format)
      .then((found) => {
        if (!cancelled) {
          setRules({ format, rules: toFormatRules(found) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRules({ format, rules: undefined });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [format]);

  const loading = facts?.key !== namesKey || rules?.format !== format;
  const result = useMemo(
    () => deckLegality(deck?.cards ?? [], loading ? '' : format, facts?.byName ?? EMPTY_FACTS, rules?.rules),
    [deck?.cards, format, facts, rules, loading],
  );
  return { ...result, loading };
}
