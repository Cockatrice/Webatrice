import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import { ShortcutScope, useShortcut } from '@app/feature-widgets/shortcuts';
import { useGridRows, type GridRowProps } from '@app/hooks';
import type { DeckCategory } from '@app/types';

import type { DeckCard } from '../types';

export const DECK_ROW_ATTRIBUTE = 'data-deck-row';

export interface DeckCardGridOptions {
  cards: readonly DeckCard[];
  order: readonly number[];
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  onSetCategory?: (index: number, category: DeckCategory) => void;
  onLastRowRemoved?: () => void;
  readOnly?: boolean;
}

export interface DeckCardRowProps extends GridRowProps {
  [DECK_ROW_ATTRIBUTE]: string;
  'aria-selected': boolean;
}

export function deckRowKey(card: DeckCard): string {
  return `${card.category}:${card.name}:${card.scryfallId ?? ''}`;
}

function swappedCategory(card: DeckCard): DeckCategory | null {
  if (card.category === 'sideboard') {
    return 'main';
  }
  return card.isCommander ? null : 'sideboard';
}

export function useDeckCardGrid({ cards, order, onInc, onDelete, onSetCategory, onLastRowRemoved, readOnly = false }: DeckCardGridOptions) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { keys, indexByKey } = useMemo(() => {
    const keys: string[] = [];
    const indexByKey = new Map<string, number>();
    for (const index of order) {
      const key = deckRowKey(cards[index]);
      keys.push(key);
      indexByKey.set(key, index);
    }
    return { keys, indexByKey };
  }, [cards, order]);

  const adjust = useCallback((key: string, delta: number) => {
    const index = indexByKey.get(key);
    if (!readOnly && index != null) {
      onInc(index, delta);
    }
  }, [indexByKey, onInc, readOnly]);

  const { getRowProps, focusRow } = useGridRows({
    keys,
    selectedKey,
    onSelect: setSelectedKey,
    onActivate: (key) => adjust(key, 1),
  });

  const remove = (key: string) => {
    const index = indexByKey.get(key);
    if (readOnly || index == null) {
      return;
    }
    const position = keys.indexOf(key);
    const neighbour = keys[position + 1] ?? keys[position - 1];
    onDelete(index);
    if (neighbour != null) {
      focusRow(neighbour);
    } else {
      onLastRowRemoved?.();
    }
  };

  const decrement = (key: string) => {
    const index = indexByKey.get(key);
    if (index != null && cards[index].quantity <= 1) {
      remove(key);
    } else {
      adjust(key, -1);
    }
  };

  const move = (index: number, category: DeckCategory) => {
    if (readOnly || !onSetCategory) {
      return;
    }
    onSetCategory(index, category);
    focusRow(deckRowKey({ ...cards[index], category }));
  };

  const swap = (key: string) => {
    const index = indexByKey.get(key);
    const category = index != null ? swappedCategory(cards[index]) : null;
    if (index != null && category != null) {
      move(index, category);
    }
  };

  const focusedKey = (): string | null =>
    (document.activeElement as HTMLElement | null)?.closest(`[${DECK_ROW_ATTRIBUTE}]`)?.getAttribute(DECK_ROW_ATTRIBUTE) ?? null;

  useShortcut('deck.addCard', () => {
    const key = focusedKey();
    if (key != null) {
      adjust(key, 1);
    }
  }, { scope: ShortcutScope.DECK_EDITOR, enabled: !readOnly && keys.length > 0 });
  useShortcut('deck.removeCard', () => {
    const key = focusedKey();
    if (key != null) {
      decrement(key);
    }
  }, { scope: ShortcutScope.DECK_EDITOR, enabled: !readOnly && keys.length > 0 });

  const getDeckRowProps = (index: number): DeckCardRowProps => {
    const key = deckRowKey(cards[index]);
    const row = getRowProps(key);
    return {
      ...row,
      [DECK_ROW_ATTRIBUTE]: key,
      'aria-selected': key === selectedKey,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const plain = !event.ctrlKey && !event.altKey && !event.metaKey;
        const ctrlAlt = event.ctrlKey && event.altKey && !event.metaKey;
        if (plain && !event.shiftKey && event.key === 'Delete') {
          remove(key);
        } else if ((plain && event.shiftKey && event.key === 'ArrowRight') || (ctrlAlt && event.code === 'Equal')) {
          adjust(key, 1);
        } else if ((plain && event.shiftKey && event.key === 'ArrowLeft') || (ctrlAlt && event.code === 'Minus')) {
          decrement(key);
        } else if (plain && event.shiftKey && event.key.toLowerCase() === 's') {
          swap(key);
        } else {
          row.onKeyDown(event);
          return;
        }
        event.preventDefault();
      },
    };
  };

  return {
    getDeckRowProps,
    removeRow: (index: number) => remove(deckRowKey(cards[index])),
    decrementRow: (index: number) => decrement(deckRowKey(cards[index])),
    moveRow: move,
  };
}

export type DeckCardGrid = ReturnType<typeof useDeckCardGrid>;
