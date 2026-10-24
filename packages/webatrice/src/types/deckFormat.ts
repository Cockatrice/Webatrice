import type { TFunction } from 'i18next';

/**
 * Format string as stored in the .cod `<format>` element. Free-form
 * strings so we can round-trip custom / non-MTG formats without
 * mangling them, but we recognize a handful of known MTG values to
 * gate MTG-specific UI (category grouping, printings picker, pricing).
 */
export type DeckFormat = string;

/**
 * MTG formats we know about, with the display label the UI renders.
 * Ordered to put commander-family formats first (most common in
 * casual play), then Standard-and-adjacent, then eternal formats,
 * then digital-only / online-first at the tail. Anything outside this
 * list is treated as a non-MTG "Other" deck (custom label allowed).
 *
 * `value` is the canonical lowercase slug stored in the .cod
 * `<format>` element — matches Cockatrice desktop's convention.
 */
export const MTG_FORMAT_LABELS: ReadonlyArray<{ value: string; label: (t: TFunction) => string }> = [
  { value: 'commander', label: (t) => t('DeckFormat.commander') },
  { value: 'paupercommander', label: (t) => t('DeckFormat.paupercommander') },
  { value: 'duel', label: (t) => t('DeckFormat.duel') },
  { value: 'oathbreaker', label: (t) => t('DeckFormat.oathbreaker') },
  { value: 'standard', label: (t) => t('DeckFormat.standard') },
  { value: 'pioneer', label: (t) => t('DeckFormat.pioneer') },
  { value: 'modern', label: (t) => t('DeckFormat.modern') },
  { value: 'legacy', label: (t) => t('DeckFormat.legacy') },
  { value: 'vintage', label: (t) => t('DeckFormat.vintage') },
  { value: 'pauper', label: (t) => t('DeckFormat.pauper') },
  { value: 'premodern', label: (t) => t('DeckFormat.premodern') },
  { value: 'oldschool', label: (t) => t('DeckFormat.oldschool') },
  { value: 'predh', label: (t) => t('DeckFormat.predh') },
  { value: 'penny', label: (t) => t('DeckFormat.penny') },
  { value: 'standardbrawl', label: (t) => t('DeckFormat.standardbrawl') },
  { value: 'historic', label: (t) => t('DeckFormat.historic') },
  { value: 'timeless', label: (t) => t('DeckFormat.timeless') },
  { value: 'gladiator', label: (t) => t('DeckFormat.gladiator') },
  { value: 'future', label: (t) => t('DeckFormat.future') },
];

/** Value-only list, derived from `MTG_FORMAT_LABELS`. Used for the
 *  `isMtgFormat` membership check. */
export const MTG_FORMATS: readonly string[] = MTG_FORMAT_LABELS.map((f) => f.value);

/** Formats that use the "designate a commander" affordance in the
 *  editor — Commander proper and Pauper Commander (same rules, common
 *  restriction). Kept as its own list so callers can extend without
 *  touching `isCommanderFormat` logic. */
export const COMMANDER_FORMATS: readonly string[] = ['commander', 'paupercommander'];

export function normalizeFormat(f: string | undefined | null): string {
  return (f ?? '').trim().toLowerCase();
}

export function isMtgFormat(f: string | undefined | null): boolean {
  return MTG_FORMATS.includes(normalizeFormat(f));
}

export function isCommanderFormat(f: string | undefined | null): boolean {
  return COMMANDER_FORMATS.includes(normalizeFormat(f));
}
