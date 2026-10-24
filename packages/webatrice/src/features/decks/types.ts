/**
 * Data-layer types for the My Decks feature. Kept flat (no nested
 * `card.printing.set`) so React components can render directly without
 * defensive chaining. See plans/my-decks-integration.md for the
 * design decisions behind the shape.
 */

import type { BracketAssessment, DeckCategory, DeckMeta } from '@app/types';

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
  if (/creature/i.test(front)) {
    return 'Creature';
  }
  if (/planeswalker/i.test(front)) {
    return 'Planeswalker';
  }
  if (/battle/i.test(front)) {
    return 'Battle';
  }
  if (/instant/i.test(front)) {
    return 'Instant';
  }
  if (/sorcery/i.test(front)) {
    return 'Sorcery';
  }
  if (/enchantment/i.test(front)) {
    return 'Enchantment';
  }
  if (/artifact/i.test(front)) {
    return 'Artifact';
  }
  if (/land/i.test(front)) {
    return 'Land';
  }
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
  /** UI-only marker for cards designated as the deck's commander.
   *  Independent of `category` — commanders always live in the
   *  `main` category (there is no separate command zone; Servatrice
   *  only reads main + side, so any card outside those two zones
   *  gets silently dropped from the game library). This flag drives
   *  deck-editor decorations (crown badge, "Set as commander" menu
   *  toggle) and lets the .cod round-trip preserve the designation
   *  via a `commander="1"` attribute on the `<card>` element. */
  isCommander?: boolean;

  // --- Metadata reconstructed from the card DB (Cockatrice XML or Scryfall)
  typeLine?: string;
  manaCost?: string;
  cmc?: number;
  colors?: string[]; // ["W", "U", ...]
  colorIdentity?: string[];
  power?: string;
  toughness?: string;

  // --- Selected printing (either the user's pick from the XML attrs
  //     or the default: newest entry in `card.set[]`)
  set?: string; // set code, e.g. "C21"
  collectorNumber?: string; // "203"
  scryfallId?: string; // Scryfall UUID — Cockatrice's `set.uuid` for modern DBs
  imageUri?: string; // preferred picurl or Scryfall CDN URL
  imageUris?: string[];
  zonePath?: string[];

  /** Where the lookup came from. `unknown` = card name wasn't in Dexie
   *  and Scryfall couldn't find it either (typo, retired card, etc.).
   *  `dexie+scryfall` = both sources merged (cards.xml base fields
   *  plus Scryfall's `all_parts` for related tokens). Rendered as a
   *  placeholder + warning only for `unknown`. */
  lookupSource: 'dexie' | 'scryfall' | 'dexie+scryfall' | 'unknown';
}

/** Post-hydration: same shape but cards are `DeckCard` (full data). */
export interface HydratedDeck {
  name: string;
  meta: DeckMeta;
  cards: DeckCard[];
  format: string;
  bannerCard?: string;
  bannerCardProviderId?: string;
  lastLoadedTimestamp?: string;
  playmatXml?: string;
  sideboardPlansXml?: string[];
  extraZonesXml?: string[];
  tagsXml?: string;
  bracketAssessment?: BracketAssessment;
}
