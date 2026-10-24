import { matchesEvent } from '@app/feature-widgets/shortcuts';
import { isCommanderFormat, isMtgFormat } from '@app/types';

import { EDHPL_MAXES } from '../../bracketData';
import { EMPTY_FILTERS, hasActiveFilters, toggleFilter, type SearchFiltersState } from '../../cardSearchQuery';
import type { ManaColor } from '../../manaSymbols';
import type { DeckCard } from '../../types';

export type DockZone = 'main' | 'side';
export type DockView = 'list' | 'art';

export function initialDockFilters(colorIdentity: readonly string[] | undefined, format: string | undefined): SearchFiltersState {
  return {
    ...EMPTY_FILTERS,
    colorMode: colorIdentity && colorIdentity.length > 0 ? 'withinIdentity' : 'includes',
    legalOnly: isMtgFormat(format),
  };
}

export function shownColours(filters: SearchFiltersState, colorIdentity: readonly string[] | undefined): string[] {
  return filters.colorMode === 'withinIdentity' ? [...(colorIdentity ?? [])] : filters.colors;
}

export function toggleDockColour(
  filters: SearchFiltersState,
  colour: ManaColor,
  colorIdentity: readonly string[] | undefined,
): SearchFiltersState {
  if (filters.colorMode === 'withinIdentity') {
    const from = (colorIdentity ?? []).filter((c): c is ManaColor => c.length === 1) as ManaColor[];
    return { ...filters, colorMode: 'atMost', colors: toggleFilter(from, colour) };
  }
  return { ...filters, colors: toggleFilter(filters.colors, colour) };
}

export function shouldSearch(text: string, filters: SearchFiltersState): boolean {
  return text.trim() !== '' || hasActiveFilters(filters);
}

export function moveHighlight(current: number, delta: number, count: number): number {
  if (count === 0) {
    return -1;
  }
  if (current < 0) {
    return delta > 0 ? 0 : count - 1;
  }
  return Math.min(count - 1, Math.max(0, current + delta));
}

export function clampHighlight(index: number, count: number): number {
  if (count === 0) {
    return -1;
  }
  return Math.min(count - 1, Math.max(0, index));
}

export function isImeComposition(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}

export function dockKeyZone(
  event: KeyboardEvent,
  bindings: { main: readonly string[]; side: readonly string[] },
): DockZone | null {
  if (bindings.side.some((s) => matchesEvent(s, event))) {
    return 'side';
  }
  if (bindings.main.some((s) => matchesEvent(s, event))) {
    return 'main';
  }
  return null;
}

export function deckQuantities(cards: readonly DeckCard[] | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards ?? []) {
    counts.set(card.name, (counts.get(card.name) ?? 0) + card.quantity);
  }
  return counts;
}

export type GameChangerNote =
  | { kind: 'none' }
  | { kind: 'present' }
  | { kind: 'count'; count: number; limit: number; over: boolean };

export function gameChangerNote({
  cardName,
  gameChangers,
  deckCards,
  format,
}: {
  cardName: string | null;
  gameChangers: ReadonlySet<string> | null;
  deckCards: readonly DeckCard[] | undefined;
  format: string | undefined;
}): GameChangerNote {
  if (!cardName || !gameChangers || !isCommanderFormat(format) || !gameChangers.has(cardName)) {
    return { kind: 'none' };
  }
  if (!deckCards) {
    return { kind: 'present' };
  }
  const inDeck = new Set(deckCards.filter((c) => c.category === 'main' && gameChangers.has(c.name)).map((c) => c.name));
  if (inDeck.has(cardName)) {
    return { kind: 'present' };
  }
  const count = inDeck.size + 1;
  const limit = EDHPL_MAXES.gameChangers[2];
  return { kind: 'count', count, limit, over: count > limit };
}

export function artCropUrl(url: string | undefined): string | undefined {
  if (url && url.includes('cards.scryfall.io')) {
    return url.replace(/(cards\.scryfall\.io\/)(small|normal|large|png|border_crop)(\/)/i, '$1art_crop$3');
  }
  return url;
}

export function isScryfallPageUrl(url: string | null): url is string {
  return url != null && url.startsWith('https://api.scryfall.com/cards/search?');
}
