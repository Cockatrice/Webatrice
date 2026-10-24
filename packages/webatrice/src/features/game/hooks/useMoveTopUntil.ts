import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoneName } from '@cockatrice/sockatrice';

import type { PlayerZoneCommands } from '../components/ui/PlayerBoard/playerBoard.types';
import { isFilterEmpty, matchCard, parseCardFilter, type CardFilter, type FilterableCard } from '../utils/cardFilter';

export interface MoveTopUntilRequest {
  filter: string;
  hits: number;
  autoPlay: boolean;
}

export interface UseMoveTopUntilOptions {
  enabled: boolean;
  stackCards: readonly { id: string; name: string }[];
  deckCount: number;
  describeCard: (name: string) => FilterableCard;
  moveCards: PlayerZoneCommands['moveCards'] | undefined;
}

interface LoopState {
  filter: CardFilter;
  remainingHits: number;
  autoPlay: boolean;
}

export function useMoveTopUntil({
  enabled,
  stackCards,
  deckCount,
  describeCard,
  moveCards,
}: UseMoveTopUntilOptions): (request: MoveTopUntilRequest) => void {
  const [loop, setLoop] = useState<LoopState | null>(null);
  const currentRef = useRef({ enabled, stackCards, deckCount, moveCards });
  currentRef.current = { enabled, stackCards, deckCount, moveCards };
  const seenStackIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !loop) {
      return;
    }
    const newIds: string[] = [];
    for (const c of stackCards) {
      if (!seenStackIdsRef.current.has(c.id)) {
        newIds.push(c.id);
      }
    }
    for (const id of newIds) {
      seenStackIdsRef.current.add(id);
    }
    if (newIds.length === 0) {
      return;
    }
    const revealedId = newIds[newIds.length - 1];
    const revealed = stackCards.find((c) => c.id === revealedId);
    if (!revealed) {
      return;
    }
    const isMatch = matchCard(loop.filter, describeCard(revealed.name));
    let remaining = loop.remainingHits;
    if (isMatch) {
      remaining -= 1;
      const revealedIdNum = Number(revealed.id);
      if (loop.autoPlay && moveCards && Number.isFinite(revealedIdNum)) {
        moveCards(ZoneName.STACK, [revealedIdNum], { zone: ZoneName.TABLE, index: 'end' });
      }
    }
    if (remaining <= 0 || deckCount <= 0 || !moveCards) {
      setLoop(null);
      return;
    }
    moveCards(ZoneName.DECK, [0], { zone: ZoneName.STACK, index: 'end' });
    if (isMatch) {
      setLoop({ ...loop, remainingHits: remaining });
    }
  }, [enabled, loop, stackCards, deckCount, describeCard, moveCards]);

  return useCallback(
    ({ filter, hits, autoPlay }: MoveTopUntilRequest) => {
      const { enabled, stackCards, deckCount, moveCards } = currentRef.current;
      if (!enabled || !moveCards || deckCount <= 0) {
        return;
      }
      const parsed = parseCardFilter(filter);
      if (isFilterEmpty(parsed)) {
        return;
      }
      seenStackIdsRef.current = new Set(stackCards.map((c) => c.id));
      setLoop({ filter: parsed, remainingHits: hits, autoPlay });
      moveCards(ZoneName.DECK, [0], { zone: ZoneName.STACK, index: 'end' });
    },
    [],
  );
}
