import type { TFunction } from 'i18next';
import { ScryfallImageSize } from '@cockatrice/datatrice';

import { getScryfallUrlByExactName, getScryfallUrlById } from '@app/services';
import { MTG_FORMAT_LABELS, MTG_FORMATS, normalizeFormat, type ParsedDeck } from '@app/types';

import { readDeckTags } from './deckTags';
import type { FlatDeck } from './deckTree';

export interface DeckSummary {
  usd?: number;
  missing?: number;
  bracketLevel?: number;
  /** `<format>` element — used for the format label chip. */
  format?: string;
  bannerCard?: string;
  bannerCardProviderId?: string;
  tags?: string[];
  commanderName?: string;
  commanderScryfallId?: string;
  cardCount?: number;
}

export function summarizeDeck(parsed: ParsedDeck): DeckSummary {
  const commander = parsed.cards.find((c) => c.isCommander);
  return {
    usd: parsed.meta.priceUsd,
    missing: parsed.meta.priceMissingCount,
    // Prefer the richer <bracketAssessment> level (matches what the
    // GameLobby reads); fall back to meta.bracketLevel for decks last
    // saved before the element existed.
    bracketLevel: parsed.bracketAssessment?.level ?? parsed.meta.bracketLevel,
    format: parsed.format || undefined,
    bannerCard: parsed.bannerCard,
    bannerCardProviderId: parsed.bannerCardProviderId,
    tags: tagsOrUndefined(readDeckTags(parsed.tagsXml)),
    commanderName: commander?.name,
    commanderScryfallId: commander?.scryfallId,
    cardCount: parsed.cards.filter((c) => c.category === 'main').reduce((sum, c) => sum + c.quantity, 0),
  };
}

function tagsOrUndefined(tags: string[]): string[] | undefined {
  return tags.length > 0 ? tags : undefined;
}

function sameTags(a: string[] = [], b: string[] = []): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

export function summariesEqual(a: DeckSummary, b: DeckSummary): boolean {
  return (
    a.usd === b.usd &&
    a.missing === b.missing &&
    a.bracketLevel === b.bracketLevel &&
    a.format === b.format &&
    a.bannerCard === b.bannerCard &&
    a.bannerCardProviderId === b.bannerCardProviderId &&
    sameTags(a.tags, b.tags) &&
    a.commanderName === b.commanderName &&
    a.commanderScryfallId === b.commanderScryfallId &&
    a.cardCount === b.cardCount
  );
}

const SCRYFALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function deckArtUrl(s: DeckSummary | undefined): string | null {
  if (!s) {
    return null;
  }
  if (s.bannerCard && s.bannerCard.trim()) {
    if (s.bannerCardProviderId && SCRYFALL_ID.test(s.bannerCardProviderId)) {
      return getScryfallUrlById(s.bannerCardProviderId, ScryfallImageSize.ArtCrop);
    }
    return getScryfallUrlByExactName(s.bannerCard.trim(), ScryfallImageSize.ArtCrop);
  }
  if (s.commanderScryfallId) {
    return getScryfallUrlById(s.commanderScryfallId, ScryfallImageSize.ArtCrop);
  }
  if (s.commanderName && s.commanderName.trim()) {
    return getScryfallUrlByExactName(s.commanderName.trim(), ScryfallImageSize.ArtCrop);
  }
  return null;
}

export function formatDisplayLabel(format: string, t: TFunction): string {
  const known = MTG_FORMAT_LABELS.find((f) => f.value === normalizeFormat(format));
  if (known) {
    return known.label(t);
  }
  return format.replace(/^\w/, (c) => c.toUpperCase());
}

export const SECTION_OTHER = 'other';
export const SECTION_LOADING = 'loading';
export const SECTION_UNKNOWN = 'unknown';

const MTG_SECTION_LABELS: Record<string, (t: TFunction) => string> = Object.fromEntries(
  MTG_FORMAT_LABELS.map((f) => [f.value, f.label]),
);

export function deckSectionLabel(section: string, t: TFunction): string {
  switch (section) {
    case SECTION_OTHER:
      return t('DeckSummary.section.other');
    case SECTION_LOADING:
      return t('Common.status.loading');
    case SECTION_UNKNOWN:
      return t('DeckSummary.section.unknown');
    default:
      return MTG_SECTION_LABELS[section]?.(t) ?? section;
  }
}

export function deckListSectionOf(summary: DeckSummary | undefined): string {
  if (!summary) {
    return SECTION_LOADING;
  }
  const n = normalizeFormat(summary.format ?? '');
  if (!n) {
    return SECTION_UNKNOWN;
  }
  if (MTG_FORMATS.includes(n)) {
    return n;
  }
  return SECTION_OTHER;
}

export interface DeckListSection {
  section: string;
  decks: FlatDeck[];
}

export function groupDecksByFormat(
  decks: FlatDeck[],
  summaries: ReadonlyMap<number, DeckSummary>,
): DeckListSection[] {
  const groups = new Map<string, FlatDeck[]>();
  for (const deck of decks) {
    const section = deckListSectionOf(summaries.get(deck.id));
    const bucket = groups.get(section) ?? [];
    bucket.push(deck);
    groups.set(section, bucket);
  }
  const order: string[] = MTG_FORMAT_LABELS.map((f) => f.value);
  order.push(SECTION_OTHER, SECTION_LOADING, SECTION_UNKNOWN);
  return order
    .filter((section) => groups.has(section))
    .map((section) => ({ section, decks: groups.get(section)! }));
}
