/**
 * Shared sort / group helpers for the two zone-view dialogs
 * (LibrarySearchDialog and IncomingRevealDialog). Both ports match
 * Cockatrice's ZoneViewWidget controls (view_zone_widget.cpp:234-250):
 * a common menu of sort keys and grouping buckets so any zone viewer
 * feels the same.
 *
 * `EnrichedCard.meta` is typed against `DeckCard` because that's what
 * both dialogs already carry — either from the user's deck data
 * (LibrarySearchDialog) or from a synthesized-from-Scryfall lookup
 * (IncomingRevealDialog). Either way we need name / type_line / cmc /
 * colors / set / power / toughness populated on `meta` for sort /
 * group to bucket sensibly.
 */

import type { DeckCard } from './mockTypes';
import { primaryType } from './mockTypes';

type HandCard = { id: string; name: string; scryfallId: string };

/** Grouping options match Cockatrice's ZoneViewWidget (view_zone_widget.cpp:234-237):
 *  Ungrouped, By Type, By Mana Value, By Color. */
export type GroupMode = 'none' | 'type' | 'cmc' | 'color';

/** Sort options match Cockatrice's ZoneViewWidget (view_zone_widget.cpp:244-250):
 *  Unsorted, By Name, By Type, By Mana Cost, By Color, By P/T, By Set. */
export type SortMode = 'none' | 'name' | 'cmc' | 'type' | 'color' | 'set' | 'pt';

export interface EnrichedCard {
  handCard: HandCard;
  meta: DeckCard;
}

export interface CardGroup {
  key: string;
  label: string;
  cards: EnrichedCard[];
}

const TYPE_ORDER = [
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
  'Other',
] as const;

const COLOR_KEY_ORDER = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
const COLOR_ALIASES: Record<string, string> = {
  w: 'W',
  u: 'U',
  b: 'B',
  r: 'R',
  g: 'G',
  c: 'C',
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
  colorless: 'C',
};

/** Filter a card by a search query supporting bare-token (name substring)
 *  and prefixed key:value expressions (t:type, c:color, cmc:N, set:XXX). */
export function matchesQuery(card: DeckCard, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const tokens = trimmed.toLowerCase().split(/\s+/);
  for (const t of tokens) {
    if (!t.includes(':')) {
      if (!card.name.toLowerCase().includes(t)) return false;
      continue;
    }
    const [rawKey, ...rest] = t.split(':');
    const key = rawKey;
    const val = rest.join(':');
    if (!val) continue;
    if (key === 't' || key === 'type') {
      if (!(card.type_line ?? '').toLowerCase().includes(val)) return false;
    } else if (key === 'c' || key === 'color') {
      const chars = val.length > 1 && !(val in COLOR_ALIASES)
        ? val.split('')
        : [val];
      const required = chars
        .map((ch) => COLOR_ALIASES[ch])
        .filter((c): c is string => Boolean(c));
      if (required.length === 0) return false;
      for (const r of required) {
        if (!card.colors.includes(r)) return false;
      }
    } else if (key === 'cmc' || key === 'mv' || key === 'manavalue') {
      const parsed = parseFloat(val);
      if (Number.isNaN(parsed) || (card.cmc ?? 0) !== parsed) return false;
    } else if (key === 'set' || key === 's') {
      if ((card.set ?? '').toLowerCase() !== val) return false;
    } else if (key === 'name' || key === 'n') {
      if (!card.name.toLowerCase().includes(val)) return false;
    } else {
      if (!card.name.toLowerCase().includes(t)) return false;
    }
  }
  return true;
}

/** Sort key for a Scryfall power/toughness string. Variable stats like
 *  "*" and "1+*" get sorted after fixed numeric values; non-creatures
 *  (null) sort last so P/T sort surfaces creatures at the top. */
function ptSortKey(v: string | null): number {
  if (v == null) return Number.POSITIVE_INFINITY;
  const n = parseFloat(v);
  if (!Number.isNaN(n)) return n;
  return 1e6; // variable/non-numeric groups after real numbers
}

export function compareCards(a: DeckCard, b: DeckCard, mode: SortMode): number {
  switch (mode) {
    case 'none':
      // Preserve caller order — matches Cockatrice's NoSort.
      return 0;
    case 'name':
      return a.name.localeCompare(b.name);
    case 'cmc':
      return (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name);
    case 'type':
      return (a.type_line ?? '').localeCompare(b.type_line ?? '') ||
        a.name.localeCompare(b.name);
    case 'color': {
      const ak = a.colors.join('');
      const bk = b.colors.join('');
      return ak.localeCompare(bk) || a.name.localeCompare(b.name);
    }
    case 'set':
      return (a.set ?? '').localeCompare(b.set ?? '') ||
        a.name.localeCompare(b.name);
    case 'pt': {
      const dp = ptSortKey(a.power) - ptSortKey(b.power);
      if (dp !== 0) return dp;
      const dt = ptSortKey(a.toughness) - ptSortKey(b.toughness);
      if (dt !== 0) return dt;
      return a.name.localeCompare(b.name);
    }
    default:
      return 0;
  }
}

export function groupCards(cards: EnrichedCard[], mode: GroupMode): CardGroup[] {
  if (mode === 'none') {
    return cards.length === 0 ? [] : [{ key: 'all', label: '', cards }];
  }

  const buckets = new Map<string, EnrichedCard[]>();
  const push = (key: string, c: EnrichedCard) => {
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  };

  if (mode === 'type') {
    for (const c of cards) push(primaryType(c.meta.type_line), c);
    return TYPE_ORDER.filter((t) => buckets.has(t)).map((t) => ({
      key: t,
      label: t,
      cards: buckets.get(t)!,
    }));
  }
  if (mode === 'cmc') {
    for (const c of cards) push(String(c.meta.cmc ?? 0), c);
    return [...buckets.keys()]
      .map(Number)
      .sort((a, b) => a - b)
      .map((n) => ({
        key: String(n),
        label: `Mana ${n}`,
        cards: buckets.get(String(n))!,
      }));
  }
  // color
  for (const c of cards) {
    const cols = c.meta.colors;
    const key = cols.length === 0 ? 'Colorless' : cols.slice().sort().join('');
    push(key, c);
  }
  return [...buckets.keys()]
    .sort((a, b) => {
      if (a === 'Colorless') return 1;
      if (b === 'Colorless') return -1;
      const rank = (k: string) =>
        k.length === 1 ? COLOR_KEY_ORDER.indexOf(k as never) : 10 + k.length;
      return rank(a) - rank(b) || a.localeCompare(b);
    })
    .map((k) => ({
      key: k,
      label: k === 'Colorless' ? 'Colorless' : k,
      cards: buckets.get(k)!,
    }));
}
