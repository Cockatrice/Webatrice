import { useCallback, useMemo, useState } from 'react';

import { ZoneName } from '@cockatrice/sockatrice';

import { useGameSelectionState } from '../components/ui/GameSelectionContext';
import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { EMPTY_SELECTION } from '../utils/selection';

export type SeatSelectionZone = 'hand' | 'battlefield' | 'stack';

export interface SeatSelection {
  zone: SeatSelectionZone;
  ids: Set<string>;
}

export interface SeatSelectableCards {
  hand: readonly { id: string }[];
  battlefield: readonly { id: string; ownerPlayerId?: number }[];
  stack: readonly { id: string }[];
}

const SEAT_ZONES: readonly SeatSelectionZone[] = ['hand', 'battlefield', 'stack'];

export const SEAT_WIRE_ZONE: Record<SeatSelectionZone, string> = {
  hand: ZoneName.HAND,
  battlefield: ZoneName.TABLE,
  stack: ZoneName.STACK,
};

export interface SeatSelectionApi {
  selection: SeatSelection | null;
  setSelection: (next: SeatSelection | null) => void;
  clearAllSelection: () => void;
}

function haveSameOrderedKeys(previous: ReadonlySet<string>, next: ReadonlySet<string>): boolean {
  if (previous.size !== next.size) {
    return false;
  }
  const previousKeys = previous.values();
  for (const key of next) {
    if (previousKeys.next().value !== key) {
      return false;
    }
  }
  return true;
}

export function useSeatSelection(playerId: number, cards: SeatSelectableCards): SeatSelectionApi {
  const game = useGameSelectionState();
  const [localKeys, setLocalKeys] = useState<ReadonlySet<string>>(EMPTY_SELECTION);
  const selectedCardKeys = game?.selectedCardKeys ?? localKeys;
  const setSelectedCardKeys = game?.setSelectedCardKeys ?? setLocalKeys;

  const keyOf = useCallback(
    (zone: SeatSelectionZone, card: { id: string; ownerPlayerId?: number }) =>
      makeCardKey(card.ownerPlayerId ?? playerId, SEAT_WIRE_ZONE[zone], Number(card.id)),
    [playerId],
  );

  const selection = useMemo<SeatSelection | null>(() => {
    if (selectedCardKeys.size === 0) {
      return null;
    }
    for (const zone of SEAT_ZONES) {
      const ids = cards[zone].filter((card) => selectedCardKeys.has(keyOf(zone, card))).map((card) => card.id);
      if (ids.length > 0) {
        return { zone, ids: new Set(ids) };
      }
    }
    return null;
  }, [selectedCardKeys, cards, keyOf]);

  const setSelection = useCallback(
    (next: SeatSelection | null) => {
      if (next) {
        const zoneCards: readonly { id: string; ownerPlayerId?: number }[] = cards[next.zone];
        const byId = new Map(zoneCards.map((card) => [card.id, card] as const));
        const keys = new Set<string>();
        next.ids.forEach((id) => keys.add(keyOf(next.zone, byId.get(id) ?? { id })));
        setSelectedCardKeys((previous) => haveSameOrderedKeys(previous, keys) ? previous : keys);
        return;
      }
      const own = new Set<string>();
      for (const zone of SEAT_ZONES) {
        cards[zone].forEach((card) => own.add(keyOf(zone, card)));
      }
      setSelectedCardKeys((prev) => {
        if (![...prev].some((key) => own.has(key))) {
          return prev;
        }
        const kept = new Set([...prev].filter((key) => !own.has(key)));
        return kept.size === 0 ? EMPTY_SELECTION : kept;
      });
    },
    [cards, keyOf, setSelectedCardKeys],
  );

  const clearAllSelection = useCallback(() => setSelectedCardKeys(EMPTY_SELECTION), [setSelectedCardKeys]);

  return { selection, setSelection, clearAllSelection };
}
