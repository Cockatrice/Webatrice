/**
 * Data-layer types for the My Decks feature. Kept flat (no nested
 * `card.printing.set`) so React components can render directly without
 * defensive chaining. See plans/my-decks-integration.md for the
 * design decisions behind the shape.
 */

export type DeckCategory = 'main' | 'sideboard' | 'commander';

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
export const MTG_FORMAT_LABELS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'commander', label: 'Commander' },
  { value: 'paupercommander', label: 'Pauper Commander' },
  { value: 'duel', label: 'Duel Commander' },
  { value: 'oathbreaker', label: 'Oathbreaker' },
  { value: 'standard', label: 'Standard' },
  { value: 'pioneer', label: 'Pioneer' },
  { value: 'modern', label: 'Modern' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'pauper', label: 'Pauper' },
  { value: 'premodern', label: 'Premodern' },
  { value: 'oldschool', label: 'Old School' },
  { value: 'predh', label: 'PreDH' },
  { value: 'penny', label: 'Penny Dreadful' },
  { value: 'standardbrawl', label: 'Standard Brawl' },
  { value: 'historic', label: 'Historic' },
  { value: 'timeless', label: 'Timeless' },
  { value: 'gladiator', label: 'Gladiator' },
  { value: 'future', label: 'Future' },
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

/** Primary card-type buckets used for grouping and stats. Kept in a
 *  fixed enumeration so downstream code can build ordered lists
 *  (curve, type breakdown, deck-editor sections) off the same set. */
export type CardTypeGroup =
  | 'Creature'
  | 'Planeswalker'
  | 'Battle'
  | 'Instant'
  | 'Sorcery'
  | 'Enchantment'
  | 'Artifact'
  | 'Land'
  | 'Other';

/**
 * Reduce a Scryfall type line to its primary card type. Splits on the
 * em-dash first so subtypes never mis-match (e.g. an
 * "Artifact — Equipment" doesn't get pulled into Creature just because
 * some subtype happens to contain the substring).
 */
export function primaryType(typeLine: string | undefined | null): CardTypeGroup {
  const front = (typeLine ?? '').split('—')[0];
  if (/creature/i.test(front)) return 'Creature';
  if (/planeswalker/i.test(front)) return 'Planeswalker';
  if (/battle/i.test(front)) return 'Battle';
  if (/instant/i.test(front)) return 'Instant';
  if (/sorcery/i.test(front)) return 'Sorcery';
  if (/enchantment/i.test(front)) return 'Enchantment';
  if (/artifact/i.test(front)) return 'Artifact';
  if (/land/i.test(front)) return 'Land';
  return 'Other';
}

/**
 * A single card row inside a deck, ready to render. Populated by the
 * hydrator (Dexie card DB lookup + Scryfall fallback) — the raw parse
 * output uses `ParsedCard` instead.
 */
export interface DeckCard {
  name: string;
  quantity: number;
  category: DeckCategory;

  // --- Metadata reconstructed from the card DB (Cockatrice XML or Scryfall)
  typeLine?: string;
  manaCost?: string;
  cmc?: number;
  colors?: string[];      // ["W", "U", ...]
  power?: string;
  toughness?: string;

  // --- Selected printing (either the user's pick from the XML attrs
  //     or the default: newest entry in `card.set[]`)
  set?: string;              // set code, e.g. "C21"
  collectorNumber?: string;  // "203"
  scryfallId?: string;       // Scryfall UUID — Cockatrice's `set.uuid` for modern DBs
  imageUri?: string;         // preferred picurl or Scryfall CDN URL

  /** Where the lookup came from. `unknown` = card name wasn't in Dexie
   *  and Scryfall couldn't find it either (typo, retired card, etc.).
   *  Rendered as a placeholder + warning. */
  lookupSource: 'dexie' | 'scryfall' | 'unknown';
}

/**
 * A parsed but un-hydrated card — just what's in the `.cod` XML. The
 * printing hints (set/num/uuid) are what the user picked previously
 * and were serialized as non-standard XML attributes.
 */
export interface ParsedCard {
  name: string;
  quantity: number;
  category: DeckCategory;
  set?: string;
  collectorNumber?: string;
  scryfallId?: string;
}

/**
 * Metadata JSON embedded inside a `.cod`'s `<comments>` element.
 * Owned entirely by webatrice; Cockatrice desktop just sees it as a
 * comment string. Versioned so future schema changes can migrate
 * older decks on the fly (see `meta.ts`).
 */
export interface DeckMeta {
  v: 1;
  /** ISO 8601. Bumped by the client on every save. Servatrice only
   *  tracks `creationTime`, so we own updated-at ourselves. */
  updatedAt: string;
  /** User-authored deck description. Kept in metadata so the raw
   *  `<comments>` element is entirely JSON — round-trips cleanly. */
  description?: string;
  /** Total USD price of the deck (sum of price × quantity across all
   *  cards). Cached after `Piece 6` computes it. Absent when never
   *  computed. */
  priceUsd?: number;
  /** Number of cards whose Scryfall price lookup came back empty. Used
   *  to show "$XXX+" or a "price incomplete" badge on the deck row. */
  priceMissingCount?: number;
  /** Last computed Commander bracket (1..5) — cached by DeckBreakdown
   *  after the edhpowerlevel-style assessment runs, so the game lobby
   *  and other consumers can render a bracket badge without re-doing
   *  the Scryfall/Spellbook fetches. Only meaningful for Commander-
   *  format decks; absent otherwise. */
  bracketLevel?: number;
}

/**
 * A single Spellbook combo as we store it in the .cod's cached
 * bracket assessment — just enough for the badge tooltip to render
 * "A + B" and link back to Spellbook.
 */
export interface BracketAssessmentCombo {
  /** Spellbook combo id — for the "view on Spellbook" link. */
  id: string;
  /** Card names in the combo. */
  cardNames: string[];
  /** Mana bill used to split early vs late (>7 = late). Kept so we
   *  don't need to re-derive it from raw combo data on cache reads. */
  totalMana: number;
}

/**
 * Full snapshot of a bracket assessment, persisted to the .cod in its
 * own `<bracketAssessment>` element. Includes every flagged card list
 * (game changers, MLD, extra turns, combos) so a consumer opening the
 * deck later can render the full breakdown without re-running the
 * Scryfall + Spellbook fetches. `fingerprint` is a short hash of the
 * deck's (name×qty) shape — if it doesn't match the deck's current
 * fingerprint, the assessment is stale and callers should re-run.
 */
export interface BracketAssessment {
  level: 1 | 2 | 3 | 4 | 5;
  fingerprint: string;
  gameChangers: string[];
  turns: string[];
  turnsRestricted: string[];
  denial: string[];
  denialRestricted: string[];
  earlyCombos: BracketAssessmentCombo[];
  lateCombos: BracketAssessmentCombo[];
}

/** Fresh-out-of-parse: XML → structured, but cards not yet hydrated. */
export interface ParsedDeck {
  name: string;
  meta: DeckMeta;
  cards: ParsedCard[];
  /** `<format>` element from the .cod. Empty string when absent — the
   *  editor treats an empty format as "unspecified" (renders as MTG
   *  since that's the historic default) rather than as Other. */
  format: string;
  /** Optional `<bannerCard>` — Cockatrice desktop's "featured card"
   *  for the deck (typically the commander). Preserved on round-trip
   *  even though we don't render it yet. */
  bannerCard?: string;
  /** Optional `<lastLoadedTimestamp>` — Cockatrice desktop stamps
   *  this whenever it opens a file. Preserved verbatim so a
   *  webatrice-authored save doesn't clobber the desktop client's
   *  bookkeeping. Not surfaced in the UI. */
  lastLoadedTimestamp?: string;
  /** Optional `<tags>` element — Cockatrice desktop's tag list.
   *  Stored as the raw XML string of the whole element so we can
   *  round-trip whatever's inside without caring about its schema. */
  tagsXml?: string;
  /** Optional `<bracketAssessment>` element — cached edhpowerlevel-
   *  style bracket result including the flagged card lists. Absent
   *  when the deck has never been assessed. Cockatrice desktop safely
   *  ignores unknown elements so this round-trips through desktop
   *  clients unchanged. */
  bracketAssessment?: BracketAssessment;
}

/** Post-hydration: same shape but cards are `DeckCard` (full data). */
export interface HydratedDeck {
  name: string;
  meta: DeckMeta;
  cards: DeckCard[];
  format: string;
  bannerCard?: string;
  lastLoadedTimestamp?: string;
  tagsXml?: string;
  bracketAssessment?: BracketAssessment;
}
