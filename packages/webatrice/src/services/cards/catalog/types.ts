/** Unified result shape returned by all `lookup*` functions. Callers
 *  can render straight from this without switching on the source. */
export interface LookupResult {
  pinnedPrintingId?: string;
  fetchedAt?: number;
  found: boolean;
  source: 'dexie' | 'scryfall' | 'dexie+scryfall' | 'unknown';
  name: string;
  typeLine?: string;
  manaCost?: string;
  cmc?: number;
  colors?: string[]; // ["W", "U", ...]
  colorIdentity?: string[];
  power?: string;
  toughness?: string;
  cipt?: boolean;
  tableRow?: number;
  /** All known printings. Cards from Dexie may have many; a Scryfall
   *  `/cards/named` lookup returns a single (default) printing. */
  printings: PrintingSummary[];
  /** Cards this card is related to — tokens (`component: "token"`)
   *  and combo pieces (`component: "combo_piece"`, which covers
   *  transform back-faces on DFCs, meld halves, and the odd combo
   *  card). Powers the card context menu's "Token: …" items
   *  (card_menu.cpp:407-479). Cockatrice presents both components
   *  under the same "Token:" label (see the addRelatedCardActions
   *  loop) — we match that behavior exactly. */
  related?: RelatedCardRef[];
  /** Scryfall's card layout ("normal", "transform", "modal_dfc",
   *  "reversible_card", "meld", "adventure", "split", "flip",
   *  "leveler", "saga", "class", "case", "prototype", "token",
   *  "emblem", "augment", "host", "art_series", "double_faced_token").
   *  Only populated when we have a Scryfall-sourced record. The
   *  right-click "Transform into …" menu item is gated on this
   *  being one of the two-faced physical layouts (transform,
   *  modal_dfc, reversible_card). */
  layout?: string;
  /** Face data for multi-faced cards (transform, modal DFC,
   *  reversible, split, adventure, flip). Ordered front → back.
   *  Only populated when Scryfall's response carried `card_faces`.
   *  Each entry mirrors the fields the "Transform into" menu item
   *  needs to fire Command_CreateToken correctly (name, mana cost,
   *  colors, PT, type line). Absent for single-face cards. */
  faces?: LookupCardFace[];
  text?: string;
  landscape?: boolean;
  properties?: Record<string, string>;
  legalities?: Record<string, string>;
}

/** One face of a multi-faced card (Scryfall's `card_faces` entry).
 *  Fields cover what our create-token / transform-into flow needs
 *  plus the per-face image URI (Scryfall's default image endpoint
 *  only returns the FRONT face for a DFC — the back-face art has
 *  to be sourced from `card_faces[N].image_uris`). */
export interface LookupCardFace {
  name: string;
  manaCost?: string;
  typeLine?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  text?: string;
  /** Per-face image URL (typically Scryfall's `normal` / ~488×680
   *  JPG). Used by Card.tsx to render the back-face art after a
   *  DFC transform lands. */
  imageUri?: string;
}

/** One entry in `LookupResult.related`. `count` mirrors the
 *  Cockatrice cards.xml attribute: `"x"` → variable count (X in the
 *  label), `"N"` → N copies, undefined → single copy (Cockatrice
 *  card_menu.cpp:442-452). `component` mirrors Scryfall's
 *  `all_parts[].component` — kept so downstream can filter if needed,
 *  though the current menu renders both as "Token: …". */
export interface RelatedCardRef {
  name: string;
  count?: string;
  attach?: string;
  persistent?: string;
  exclude?: string;
  component?: 'token' | 'combo_piece' | 'meld_part' | 'meld_result';
  /** Provenance of the relation. `'scryfall'` means the ref came
   *  from Scryfall `all_parts`; `'related'` / `'reverse-related'`
   *  means it came from cards.xml. */
  origin: 'related' | 'reverse-related' | 'scryfall';
  /** Scryfall id for the related card, when known. Populated from
   *  Scryfall `all_parts[].id`; lets the Command_CreateToken caller
   *  send a `card_provider_id` so the server picks the exact art. */
  scryfallId?: string;
}

export interface PrintingSummary {
  name?: string;
  set?: string;
  collectorNumber?: string;
  scryfallId?: string;
  imageUri?: string;
  imageUris?: string[];
}

/** Optional set / collector-number hints paired with a card name.
 *  Deck import parses these from lines like `1 Donnie's Bō (TMN) 42`
 *  and forwards them into `lookupCards` so the Scryfall batch
 *  request can identify the exact printing rather than fuzzy-
 *  matching on name alone. Name-only inputs (single-card lookups,
 *  hand-typed searches) can still pass a plain string via the
 *  `LookupInput` union — no caller changes required unless the
 *  caller has printing info to offer. */
export interface LookupHint {
  name: string;
  scryfallId?: string;
  set?: string;
  collectorNumber?: string;
}

/** Callers can mix plain names and hints in a single call. Internal
 *  code normalizes to `LookupHint` before doing anything. */
export type LookupInput = string | LookupHint;
