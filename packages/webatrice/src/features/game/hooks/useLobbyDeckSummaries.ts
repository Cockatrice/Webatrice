import { useEffect, useMemo, useRef, useState } from 'react';
import { server } from '@cockatrice/datatrice';
import { useBackendDeckDownload, useReduxEffect } from '@app/hooks';
import type { BackendDeck } from '@app/hooks';
import { parseCod } from '@app/services';
import { onSessionEnd } from '@app/services/session';
import type { DeckSummary } from '../components/lobby/lobbyDeckGrouping';

const deckSummaryCache = new Map<number, DeckSummary>();
onSessionEnd(() => deckSummaryCache.clear());

export function useLobbyDeckSummaries(myDecks: BackendDeck[], isConnected: boolean) {
  const downloadDeck = useBackendDeckDownload();
  const [summaryByDeckId, setSummaryByDeckId] = useState<Map<number, DeckSummary>>(
    () => new Map(deckSummaryCache),
  );
  const inFlightRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!isConnected) {
      return;
    }
    for (const deck of myDecks) {
      if (summaryByDeckId.has(deck.id)) {
        continue;
      }
      if (inFlightRef.current.has(deck.id)) {
        continue;
      }
      inFlightRef.current.add(deck.id);
      downloadDeck(deck.id);
    }
  }, [isConnected, myDecks, summaryByDeckId, downloadDeck]);

  useReduxEffect<{ deckId: number; deck: string }>(
    ({ payload }) => {
      inFlightRef.current.delete(payload.deckId);
      let summary: DeckSummary;
      try {
        const parsed = parseCod(payload.deck);
        // Prefer the level stored in the richer <bracketAssessment>
        // element (which also carries the flagged card lists); fall
        // back to meta.bracketLevel for decks last saved before the
        // new element existed.
        summary = {
          format: parsed.format ?? '',
          bracketLevel: parsed.bracketAssessment?.level ?? parsed.meta.bracketLevel,
          name: parsed.name,
        };
      } catch {
        // Malformed .cod → cache empty so we don't re-download.
        summary = { format: '', bracketLevel: undefined, name: '' };
      }
      deckSummaryCache.set(payload.deckId, summary);
      setSummaryByDeckId((prev) => {
        const existing = prev.get(payload.deckId);
        if (
          existing &&
          existing.format === summary.format &&
          existing.bracketLevel === summary.bracketLevel &&
          existing.name === summary.name
        ) {
          return prev;
        }
        const next = new Map(prev);
        next.set(payload.deckId, summary);
        return next;
      });
    },
    server.Types.DECK_DOWNLOADED,
    [],
  );

  const bracketByDeckId = useMemo(() => {
    const out = new Map<number, number>();
    for (const [id, s] of summaryByDeckId) {
      if (s.bracketLevel != null) {
        out.set(id, s.bracketLevel);
      }
    }
    return out;
  }, [summaryByDeckId]);

  const stillLoadingFormats = myDecks.some((deck) => !summaryByDeckId.has(deck.id));
  return { summaryByDeckId, bracketByDeckId, stillLoadingFormats };
}
