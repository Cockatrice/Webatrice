import type { BackendDeck } from '@app/hooks';
import { MTG_FORMAT_LABELS, MTG_FORMATS, normalizeFormat } from '@app/types';
import type { TFunction } from 'i18next';

export interface DeckSummary {
  format: string;
  bracketLevel?: number;
  /** Deck name from the .cod's <deckname> — used to match a
   *  selected deck back to its badge after the server accepts the
   *  deckSelect. Servatrice broadcasts deckHash but not the name. */
  name: string;
}

const CATEGORY_OTHER = 'other';
const CATEGORY_UNKNOWN = 'unknown';
const CATEGORY_LABELS: Record<string, (t: TFunction) => string> = Object.fromEntries(
  MTG_FORMAT_LABELS.map((f) => [f.value, f.label]),
);

export function lobbyDeckCategoryLabel(category: string, t: TFunction): string {
  if (category === CATEGORY_OTHER) {
    return t('GameLobby.deckCategory.other');
  }
  if (category === CATEGORY_UNKNOWN) {
    return t('GameLobby.deckCategory.unknown');
  }
  return CATEGORY_LABELS[category]?.(t) ?? category;
}

/** Bucket a deck's format string into a category slug for display. */
function categoryOf(format: string | undefined): string {
  const n = normalizeFormat(format ?? '');
  if (!n) {
    return CATEGORY_UNKNOWN;
  }
  if (MTG_FORMATS.includes(n)) {
    return n;
  }
  return CATEGORY_OTHER;
}

export function groupLobbyDecks(myDecks: BackendDeck[], summaryByDeckId: ReadonlyMap<number, DeckSummary>, roomFormatSlug: string) {
  const groups = new Map<string, BackendDeck[]>();
  for (const deck of myDecks) {
    const cat = categoryOf(summaryByDeckId.get(deck.id)?.format);
    const bucket = groups.get(cat) ?? [];
    bucket.push(deck);
    groups.set(cat, bucket);
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
  const order: string[] = [];
  if (roomFormatSlug && MTG_FORMATS.includes(roomFormatSlug)) {
    order.push(roomFormatSlug);
  }
  for (const f of MTG_FORMAT_LABELS) {
    if (f.value === roomFormatSlug) {
      continue;
    }
    order.push(f.value);
  }
  order.push(CATEGORY_OTHER);
  order.push(CATEGORY_UNKNOWN);
  return order
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ category: cat, decks: groups.get(cat)! }));

}
