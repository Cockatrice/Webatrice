import { useMemo } from 'react';
import { useBackendDeckList } from '@app/hooks';

export function useBackendDeckNames(): ReadonlyMap<number, string> {
  const { decks } = useBackendDeckList();
  return useMemo(() => new Map(decks.filter(deck => deck.id && deck.name).map(deck => [deck.id, deck.name])), [decks]);
}
