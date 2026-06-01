import { Dispatch, SetStateAction, useCallback, useState } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { EMPTY_SELECTION } from '../utils/selection';

export interface GameSelection {
  selectedCardKeys: ReadonlySet<string>;
  setSelectedCardKeys: Dispatch<SetStateAction<ReadonlySet<string>>>;
  // The card whose details drive the locked preview pane.
  focused: { key: string; card: ServerInfo_Card } | null;
  onCardFocus: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardBlur: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  collapseUnlessSelected: (
    ownerPlayerId: number | undefined,
    zone: string | undefined,
    card: ServerInfo_Card,
  ) => void;
  clearSelection: () => void;
  clearFocused: () => void;
}

export function useGameSelection(): GameSelection {
  const [selectedCardKeys, setSelectedCardKeys] = useState<ReadonlySet<string>>(EMPTY_SELECTION);
  const [focused, setFocused] = useState<{ key: string; card: ServerInfo_Card } | null>(null);

  const onCardFocus = useCallback(
    (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => {
      if (ownerPlayerId == null || zone == null) {
        return;
      }
      setFocused({ key: makeCardKey(ownerPlayerId, zone, card.id), card });
    },
    [],
  );

  const onCardBlur = useCallback(
    (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => {
      if (ownerPlayerId == null || zone == null) {
        return;
      }
      const blurredKey = makeCardKey(ownerPlayerId, zone, card.id);
      // Defer so a sibling card's focus (which fires after blur) wins.
      queueMicrotask(() => {
        setFocused((prev) => (prev?.key === blurredKey ? null : prev));
      });
    },
    [],
  );

  const collapseUnlessSelected = useCallback(
    (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => {
      if (ownerPlayerId == null || zone == null) {
        return;
      }
      const key = makeCardKey(ownerPlayerId, zone, card.id);
      setFocused({ key, card });
      setSelectedCardKeys((prev) => (prev.has(key) ? prev : new Set([key])));
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedCardKeys(EMPTY_SELECTION);
  }, []);

  const clearFocused = useCallback(() => {
    setFocused(null);
  }, []);

  return {
    selectedCardKeys,
    setSelectedCardKeys,
    focused,
    onCardFocus,
    onCardBlur,
    collapseUnlessSelected,
    clearSelection,
    clearFocused,
  };
}
