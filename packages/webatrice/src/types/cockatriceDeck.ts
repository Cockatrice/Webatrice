
// Commander is not a distinct category — there is no separate
// command zone in webatrice, and every card lives in either the
// main deck or the sideboard (matching Cockatrice's own
// libcockatrice_deck_list zone constants). If you're looking for
// commander-marking UI, it was intentionally removed.
export type DeckCategory = 'main' | 'sideboard';

export const DECK_ZONE_MAIN = 'main';
export const DECK_ZONE_SIDE = 'side';

/**
 * A parsed but un-hydrated card — just what's in the `.cod` XML. The
 * printing hints (set/num/uuid) are what the user picked previously
 * and were serialized as non-standard XML attributes.
 */
export interface ParsedCard {
  name: string;
  quantity: number;
  category: DeckCategory;
  /** Commander marker restored from the .cod `commander="1"` attr
   *  (or, for legacy files, from a card that lived in a
   *  `<zone name="commander">` block). See DeckCard.isCommander for
   *  the full rationale. */
  isCommander?: boolean;
  set?: string;
  collectorNumber?: string;
  scryfallId?: string;
  zonePath?: string[];
}

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
  /** Names of cards designated as commanders. The per-card XML
   *  attribute (`commander="1"`) is the primary source, but Servatrice's
   *  `Command_DeckUpload` re-parses the file through Cockatrice's
   *  `DeckList::loadFromXml`, which drops attributes it doesn't
   *  recognize — so the attribute alone is lost on server round-trip.
   *  This list lives in the `<comments>` JSON blob (opaque text
   *  Servatrice preserves verbatim) and is overlaid onto cards at
   *  parse time so the flag survives the round-trip. Empty / absent
   *  = no commanders designated. */
  commanders?: string[];
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
  bannerCard?: string;
  bannerCardProviderId?: string;
  /** Optional `<lastLoadedTimestamp>` — Cockatrice desktop stamps
   *  this whenever it opens a file. Preserved verbatim so a
   *  webatrice-authored save doesn't clobber the desktop client's
   *  bookkeeping. Not surfaced in the UI. */
  lastLoadedTimestamp?: string;
  playmatXml?: string;
  sideboardPlansXml?: string[];
  extraZonesXml?: string[];
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
