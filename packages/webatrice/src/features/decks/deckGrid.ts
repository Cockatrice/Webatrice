import { normalizeFormat } from '@app/types';

import { deckArtUrl, type DeckSummary } from './deckSummary';
import type { FlatDeck } from './deckTree';

export const IDENTITY_COLOURS = ['W', 'U', 'B', 'R', 'G'] as const;
export type IdentityColour = (typeof IDENTITY_COLOURS)[number];

export interface DeckTileView {
  deck: FlatDeck;
  summary: DeckSummary | undefined;
  colours: string | undefined;
  artUrl: string | null;
  tags: string[];
  format: string | undefined;
  bracket: number | undefined;
}

export function deckTileView(deck: FlatDeck, summary: DeckSummary | undefined): DeckTileView {
  const banner = deck.bannerCardName
    ? { bannerCard: deck.bannerCardName, bannerCardProviderId: deck.bannerCardProvider }
    : {};
  return {
    deck,
    summary,
    colours: deck.colorIdentity?.toUpperCase(),
    artUrl: deckArtUrl(summary || deck.bannerCardName ? { ...summary, ...banner } : undefined),
    tags: deck.tags ?? summary?.tags ?? [],
    format: summary?.format ? normalizeFormat(summary.format) || summary.format : undefined,
    bracket: summary?.bracketLevel,
  };
}

export type ColourMode = 'including' | 'exactly' | 'atMost';
export const COLOUR_MODES: readonly ColourMode[] = ['including', 'exactly', 'atMost'];

export interface DeckGridFilters {
  query: string;
  colours: readonly IdentityColour[];
  colourMode: ColourMode;
  format: string | null;
  bracket: number | null;
  tags: readonly string[];
}

export const NO_DECK_FILTERS: DeckGridFilters = {
  query: '', colours: [], colourMode: 'including', format: null, bracket: null, tags: [],
};

export function hasDeckFilters(filters: DeckGridFilters): boolean {
  return filters.query.trim() !== '' || filters.colours.length > 0 || filters.format != null
    || filters.bracket != null || filters.tags.length > 0;
}

type Match = boolean | 'pending';

function matchesQuery(view: DeckTileView, query: string): Match {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) {
    return true;
  }
  if (view.deck.name.toLocaleLowerCase().includes(needle)
    || view.tags.some((tag) => tag.toLocaleLowerCase().includes(needle))) {
    return true;
  }
  return view.summary || view.deck.tags ? false : 'pending';
}

export function matchesColours(identity: string | undefined, colours: readonly string[], mode: ColourMode): boolean {
  if (colours.length === 0) {
    return true;
  }
  if (identity === undefined) {
    return false;
  }
  const own = new Set(identity.toUpperCase().split(''));
  switch (mode) {
    case 'including':
      return colours.every((c) => own.has(c));
    case 'exactly':
      return own.size === colours.length && colours.every((c) => own.has(c));
    case 'atMost':
      return [...own].every((c) => colours.includes(c));
  }
}

function matchesSummary(view: DeckTileView, filters: DeckGridFilters): Match {
  const needsSummary = filters.format != null || filters.bracket != null || (filters.tags.length > 0 && !view.deck.tags);
  if (needsSummary && !view.summary) {
    return 'pending';
  }
  return (filters.format == null || view.format === filters.format)
    && (filters.bracket == null || view.bracket === filters.bracket)
    && filters.tags.every((tag) => view.tags.includes(tag));
}

export function filterDeckViews(
  views: readonly DeckTileView[],
  filters: DeckGridFilters,
): { shown: DeckTileView[]; pending: number } {
  const shown: DeckTileView[] = [];
  let pending = 0;
  for (const view of views) {
    if (!matchesColours(view.colours, filters.colours, filters.colourMode)) {
      continue;
    }
    const query = matchesQuery(view, filters.query);
    const rest = matchesSummary(view, filters);
    if (query === false || rest === false) {
      continue;
    }
    if (query === 'pending' || rest === 'pending') {
      pending++;
      continue;
    }
    shown.push(view);
  }
  return { shown, pending };
}

export type DeckGridSort = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';
export const DECK_GRID_SORTS: readonly DeckGridSort[] = ['newest', 'oldest', 'nameAsc', 'nameDesc'];

export function sortDeckViews(views: readonly DeckTileView[], sort: DeckGridSort, locale?: string): DeckTileView[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const byName = (a: DeckTileView, b: DeckTileView) =>
    collator.compare(a.deck.name, b.deck.name);
  const compare: Record<DeckGridSort, (a: DeckTileView, b: DeckTileView) => number> = {
    newest: (a, b) => b.deck.creationTime - a.deck.creationTime || byName(a, b),
    oldest: (a, b) => a.deck.creationTime - b.deck.creationTime || byName(a, b),
    nameAsc: (a, b) => byName(a, b) || a.deck.id - b.deck.id,
    nameDesc: (a, b) => byName(b, a) || a.deck.id - b.deck.id,
  };
  return [...views].sort(compare[sort]);
}

export interface DeckFilterOptions {
  tags: string[];
  formats: string[];
  brackets: number[];
}

export function deckFilterOptions(views: readonly DeckTileView[], selected: DeckGridFilters): DeckFilterOptions {
  const tags = new Set<string>(selected.tags);
  const formats = new Set<string>(selected.format ? [selected.format] : []);
  const brackets = new Set<number>(selected.bracket != null ? [selected.bracket] : []);
  for (const view of views) {
    view.tags.forEach((tag) => tags.add(tag));
    if (view.format) {
      formats.add(view.format);
    }
    if (view.bracket != null) {
      brackets.add(view.bracket);
    }
  }
  return {
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
    formats: [...formats].sort((a, b) => a.localeCompare(b)),
    brackets: [...brackets].sort((a, b) => a - b),
  };
}

export function toggleListValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
