import { useEffect, useRef, type RefObject } from 'react';

import type { DeckListSection } from '../deckSummary';
import type { FlatDeck } from '../deckTree';

export const DECK_LIST_ROW_ATTRIBUTE = 'data-deck-id';

export function useDeckDeleteFocus(sections: readonly DeckListSection[], fallbackRef: RefObject<HTMLElement | null>) {
  const pending = useRef<{ deleted: number; neighbour: number | null } | null>(null);

  useEffect(() => {
    const target = pending.current;
    if (!target || sections.some(({ decks }) => decks.some((deck) => deck.id === target.deleted))) {
      return;
    }
    pending.current = null;
    if (document.activeElement != null && document.activeElement !== document.body) {
      return;
    }
    const row = target.neighbour != null
      ? document.querySelector<HTMLElement>(`[${DECK_LIST_ROW_ATTRIBUTE}="${target.neighbour}"] button`)
      : null;
    if (row) {
      row.focus();
      return;
    }
    const fallback = fallbackRef.current;
    if (fallback) {
      fallback.setAttribute('tabindex', '-1');
      fallback.addEventListener('blur', () => fallback.removeAttribute('tabindex'), { once: true });
      fallback.focus();
    }
  }, [sections, fallbackRef]);

  return (deck: FlatDeck) => {
    const ids = sections.flatMap(({ decks }) => decks.map(({ id }) => id));
    const position = ids.indexOf(deck.id);
    pending.current = { deleted: deck.id, neighbour: ids[position + 1] ?? ids[position - 1] ?? null };
  };
}
