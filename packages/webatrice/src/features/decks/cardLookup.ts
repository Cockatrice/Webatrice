import {
  dexieService,
  type Card,
  type CardInSet,
  type RelatedCard,
} from '@app/services';
import { ScryfallImageSize } from '@cockatrice/datatrice';

/**
 * Card DB lookup helpers for the decks feature. Two tables back this:
 *
 *   1. Dexie `cards` — populated from the user's imported Cockatrice
 *      cards.xml. Cockatrice-XML-shaped ({value, ...attrs} leaves,
 *      nested `prop`, etc.), keyed by `name.value`. Source of truth
 *      for the fields cards.xml carries: printings (with picurl for
 *      self-hosted mirrors), Cockatrice's per-card `related` /
 *      `reverse-related` count / persistent attributes, tablerow.
 *   2. Dexie `scryfallCache` — Scryfall-shaped read-through cache
 *      keyed by `name`. Written the first time we fetch a card from
 *      Scryfall (either because cards.xml doesn't have it, or because
 *      we need Scryfall's `all_parts` for the related-tokens menu).
 *      Distinct table so the Cockatrice-XML-shaped `cards` table
 *      stays single-source — see the note on Stores.SCRYFALL_CACHE.
 *
 * `lookupCard` merges both when available: cards.xml wins for base
 * fields (typeLine/PT/manaCost — cards.xml is more consistent with
 * the user's card corpus), Scryfall wins for `related` (only Scryfall
 * has `all_parts` which lists tokens by their canonical name and
 * gives us the token image via scryfallId). Cards.xml's related count
 * / persistent modifiers overlay onto Scryfall's list by name match.
 */

/** Unified result shape returned by all `lookup*` functions. Callers
 *  can render straight from this without switching on the source. */
export interface LookupResult {
  found: boolean;
  source: 'dexie' | 'scryfall' | 'dexie+scryfall' | 'unknown';
  name: string;
  typeLine?: string;
  manaCost?: string;
  cmc?: number;
  colors?: string[];      // ["W", "U", ...]
  power?: string;
  toughness?: string;
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
  set?: string;
  collectorNumber?: string;
  scryfallId?: string;
  imageUri?: string;
}

/**
 * Look up a single card by name. Merges Dexie cards.xml data (if we
 * have the card) with Scryfall data (from persistent cache, else
 * network fetch). Falls back to `{ found: false, source: 'unknown',
 * ... }` if neither source knows the card. Names should be exact
 * (case-insensitive match handled internally by Dexie's primary key
 * / Scryfall's exact endpoint).
 */
export async function lookupCard(name: string): Promise<LookupResult> {
  const [xmlHit, scryfallCached] = await Promise.all([
    getFromDexie(name),
    getFromScryfallCache(name),
  ]);
  const xmlLookup = xmlHit ? dexieToLookup(xmlHit) : undefined;

  let scryfallLookup = scryfallCached;
  if (!scryfallLookup) {
    const fetched = await fetchScryfall(name);
    if (fetched) {
      scryfallLookup = scryfallToLookup(fetched);
      // Write-through to the persistent cache. Fire-and-forget —
      // a stalled Dexie write shouldn't hold up the caller.
      void putScryfallCache(scryfallLookup);
    }
  }

  return mergeLookup(name, xmlLookup, scryfallLookup);
}

/**
 * Batch version: parallel Dexie `bulkGet` on both tables, then
 * Scryfall `/cards/collection` (POST, 75 identifiers per request)
 * for any name we don't already have Scryfall data for. Returns a
 * Map keyed by input name for O(1) lookups by the caller.
 *
 * The batched Scryfall path is what makes hydrating an imported .cod
 * on a fresh Dexie DB take 1–2 network round-trips instead of one per
 * card. `/cards/named?exact=` (used by the single-card `lookupCard`)
 * is intentionally reserved for the one-off "add card by name" flow
 * where the caller has exactly one name.
 */
/**
 * Session-scoped memo for `lookupCards`. Cleared on page reload but
 * survives every dialog open in between. Keyed by exact input name.
 * Only successful lookups (source !== 'unknown') are stored so a
 * transient network failure doesn't stick.
 *
 * Motivation: even with the persistent Dexie scryfallCache, checking
 * Dexie once per repeated call still costs an IndexedDB roundtrip.
 * In-memory cache is O(1) for the hot repeat-lookup case (multiple
 * dialogs opened in a session referencing the same names).
 */
const sessionCache = new Map<string, LookupResult>();

export async function lookupCardsCached(names: string[]): Promise<Map<string, LookupResult>> {
  const out = new Map<string, LookupResult>();
  const missing: string[] = [];
  for (const name of names) {
    const cached = sessionCache.get(name);
    if (cached) {
      out.set(name, cached);
    } else {
      missing.push(name);
    }
  }
  if (missing.length === 0) {
    return out;
  }
  const fresh = await lookupCards(missing);
  for (const [name, result] of fresh) {
    out.set(name, result);
    if (result.source !== 'unknown') {
      sessionCache.set(name, result);
    }
  }
  return out;
}

export async function lookupCards(names: string[]): Promise<Map<string, LookupResult>> {
  const out = new Map<string, LookupResult>();
  const uniqueNames = Array.from(new Set(names));
  if (uniqueNames.length === 0) return out;

  const [xmlHits, scryfallCached] = await Promise.all([
    bulkGetFromDexie(uniqueNames),
    bulkGetFromScryfallCache(uniqueNames),
  ]);

  // Names we still need to fetch from Scryfall. Any name without a
  // scryfallCache hit — regardless of whether cards.xml has it —
  // because we want Scryfall's `all_parts` list for the related-
  // tokens menu.
  const scryfallLookups = new Map<string, LookupResult>();
  for (let i = 0; i < uniqueNames.length; i++) {
    const cached = scryfallCached[i];
    if (cached) {
      scryfallLookups.set(uniqueNames[i], cached);
    }
  }

  const needScryfall: string[] = [];
  for (const name of uniqueNames) {
    if (!scryfallLookups.has(name)) {
      needScryfall.push(name);
    }
  }

  if (needScryfall.length > 0) {
    // Track the request name → the cleaned name we actually sent to
    // Scryfall (the "(Token)" suffix stripper). Scryfall's response
    // echoes the resolved name, not our input, so we key the output
    // by the original request name via this indirection.
    const cleanedByRequest = new Map<string, string>();
    for (const name of needScryfall) {
      cleanedByRequest.set(name, cleanScryfallName(name));
    }
    const collected = await batchFetchScryfall(
      Array.from(new Set(cleanedByRequest.values())),
    );
    const toCache: LookupResult[] = [];
    for (const name of needScryfall) {
      const cleaned = cleanedByRequest.get(name)!;
      const hit = collected.get(cleaned.toLowerCase());
      if (hit) {
        const parsed = scryfallToLookup(hit);
        scryfallLookups.set(name, parsed);
        toCache.push(parsed);
      }
    }
    if (toCache.length > 0) {
      // Fire-and-forget. Cache misses on write don't affect the
      // return value — we've already got the parsed data in-hand.
      void bulkPutScryfallCache(toCache);
    }
  }

  for (let i = 0; i < uniqueNames.length; i++) {
    const key = uniqueNames[i];
    const xmlLookup = xmlHits[i] ? dexieToLookup(xmlHits[i]!) : undefined;
    const scryfallLookup = scryfallLookups.get(key);
    out.set(key, mergeLookup(key, xmlLookup, scryfallLookup));
  }

  return out;
}

// ---------- Merge ----------

/**
 * Merge Dexie cards.xml data with Scryfall data (persistent cache or
 * fresh fetch). Rules:
 *   - Base fields (typeLine, PT, manaCost, colors, cmc) prefer the
 *     XML shape — cards.xml is the user's canonical import and stays
 *     consistent with their card corpus.
 *   - `related` prefers Scryfall (only Scryfall's `all_parts` gives
 *     us the token's scryfallId for image fetches), with cards.xml
 *     count/persistent modifiers overlaid by name match.
 *   - printings prefers XML (has the user's mirror URLs); if only
 *     Scryfall is available, uses Scryfall's single printing.
 */
function mergeLookup(
  name: string,
  xml: LookupResult | undefined,
  scryfall: LookupResult | undefined,
): LookupResult {
  if (!xml && !scryfall) {
    return { found: false, source: 'unknown', name, printings: [] };
  }
  if (xml && !scryfall) {
    return xml;
  }
  if (!xml && scryfall) {
    return scryfall;
  }
  // Both present. Base = XML; overlay Scryfall for related list.
  const xmlRelated = xml!.related ?? [];
  const scryfallRelated = scryfall!.related ?? [];
  // Overlay: for each Scryfall entry, if cards.xml has a matching
  // name, promote its count/persistent onto the Scryfall entry.
  const xmlByName = new Map(xmlRelated.map((r) => [r.name, r]));
  const overlaid: RelatedCardRef[] = scryfallRelated.map((s) => {
    const x = xmlByName.get(s.name);
    return x
      ? { ...s, count: x.count ?? s.count, persistent: x.persistent ?? s.persistent, attach: x.attach ?? s.attach }
      : s;
  });
  // Any cards.xml relations Scryfall didn't surface (rare — usually
  // a cards.xml `<related>` for a card missing from Scryfall's
  // dataset) still make it in.
  const seenNames = new Set(overlaid.map((r) => r.name));
  for (const x of xmlRelated) {
    if (!seenNames.has(x.name)) {
      overlaid.push(x);
    }
  }
  return {
    ...xml!,
    source: 'dexie+scryfall',
    related: overlaid.length > 0 ? overlaid : undefined,
    // Layout + faces only live on Scryfall records (cards.xml
    // doesn't carry them), so pull directly from that side without
    // any merging logic. Powers the "Transform into …" menu item.
    layout: scryfall!.layout,
    faces: scryfall!.faces,
  };
}

// ---------- Dexie: cards.xml table ----------

async function getFromDexie(name: string): Promise<Card | undefined> {
  try {
    return (await dexieService.cards.get(name)) as Card | undefined;
  } catch {
    return undefined;
  }
}

async function bulkGetFromDexie(names: string[]): Promise<Array<Card | undefined>> {
  try {
    return (await dexieService.cards.bulkGet(names)) as Array<Card | undefined>;
  } catch {
    return names.map(() => undefined);
  }
}

function dexieToLookup(card: Card): LookupResult {
  const prop = card.prop?.value ?? {};
  const printings: PrintingSummary[] = normalizeSets(card.set).map((s) => ({
    set: s.value || undefined,
    collectorNumber: s.num,
    scryfallId: s.uuid,
    imageUri: pickImageUri(s),
  }));

  // Cockatrice merges related + reverse-related into one flat list
  // (card_info.h:249 `getAllRelatedCards`). Keeping the origin lets
  // callers filter if they want, but the default menu render treats
  // both directions the same. Dedupe by name so a card that appears
  // in both directions doesn't render twice.
  //
  // Both fields go through normalizeRelated because the Cockatrice
  // XML parser collapses single-occurrence repeated tags to a scalar
  // object rather than a one-element array (see
  // CockatriceXmlParser.parseElement lines 95-101). A card with a
  // single `<related>Bird</related>` (Swan Song) lands as
  // `related: {value: "Bird"}` — iterating that as an array of
  // RelatedCard would silently produce zero token items.
  const relatedList: RelatedCardRef[] = [];
  const seenNames = new Set<string>();
  for (const entry of normalizeRelated(card.related)) {
    if (!entry.value || seenNames.has(entry.value)) {
      continue;
    }
    seenNames.add(entry.value);
    relatedList.push({
      name: entry.value,
      count: entry.count,
      attach: entry.attach,
      persistent: entry.persistent,
      origin: 'related',
    });
  }
  for (const entry of normalizeRelated(card['reverse-related'])) {
    if (!entry.value || seenNames.has(entry.value)) {
      continue;
    }
    seenNames.add(entry.value);
    relatedList.push({
      name: entry.value,
      count: entry.count,
      attach: entry.attach,
      persistent: entry.persistent,
      origin: 'reverse-related',
    });
  }

  return {
    found: true,
    source: 'dexie',
    name: card.name.value,
    typeLine: readStringProp(prop.type),
    manaCost: readStringProp(prop.manacost),
    cmc: readNumberProp(prop.cmc),
    colors: splitColors(readStringProp(prop.colors) ?? readStringProp(prop.coloridentity)),
    power: readStringProp(prop.power),
    toughness: readStringProp(prop.toughness),
    printings,
    related: relatedList.length > 0 ? relatedList : undefined,
  };
}

// ---------- Dexie: scryfallCache table ----------

async function getFromScryfallCache(name: string): Promise<LookupResult | undefined> {
  try {
    const raw = (await dexieService.scryfallCache.get(name)) as
      | LookupResult
      | undefined;
    return raw ? sanitizeCached(raw) : undefined;
  } catch {
    return undefined;
  }
}

async function bulkGetFromScryfallCache(
  names: string[],
): Promise<Array<LookupResult | undefined>> {
  try {
    const raw = (await dexieService.scryfallCache.bulkGet(names)) as Array<
      LookupResult | undefined
    >;
    return raw.map((r) => (r ? sanitizeCached(r) : undefined));
  } catch {
    return names.map(() => undefined);
  }
}

/**
 * Drop stale `combo_piece` entries from a cached Scryfall record.
 * We used to write those into the cache, but they turned out to be
 * unreliable (see the `scryfallToLookup` comment). Filtering on
 * read lets old cached records self-heal without a schema bump —
 * the next time we re-fetch and write, the record will already be
 * clean. Cheap enough to run every read.
 */
function sanitizeCached(result: LookupResult): LookupResult {
  if (!result.related) {
    return result;
  }
  const filtered = result.related.filter((r) => r.component !== 'combo_piece');
  if (filtered.length === result.related.length) {
    return result;
  }
  return { ...result, related: filtered.length > 0 ? filtered : undefined };
}

async function putScryfallCache(result: LookupResult): Promise<void> {
  try {
    // Dexie's put replaces the whole record — safe for our use since
    // we always store the full merged LookupResult (not partial
    // patches). Failures are swallowed so a full-disk / permissions
    // error doesn't break the caller.
    await dexieService.scryfallCache.put(result);
  } catch {
    /* ignore */
  }
}

async function bulkPutScryfallCache(results: LookupResult[]): Promise<void> {
  if (results.length === 0) return;
  try {
    await dexieService.scryfallCache.bulkPut(results);
  } catch {
    /* ignore */
  }
}

function pickImageUri(printing: CardInSet): string | undefined {
  // Prefer the imported card DB's picurl (respects self-hosted mirrors);
  // fall back to Scryfall CDN by UUID.
  if (printing.picurl) return printing.picurl;
  if (printing.picURL) return printing.picURL;
  if (printing.uuid) {
    return `https://api.scryfall.com/cards/${encodeURIComponent(printing.uuid)}?format=image&version=${ScryfallImageSize.Small}`;
  }
  return undefined;
}

function normalizeSets(setField: CardInSet | CardInSet[] | undefined): CardInSet[] {
  // Cockatrice XML collapses single-element repeated tags to a
  // scalar; `set` can be one printing or many. Signature is broader
  // than Card['set'] so token records (whose `set` is optional) can
  // reuse the same helper.
  if (!setField) return [];
  return Array.isArray(setField) ? setField : [setField];
}

// Same collapse quirk as `normalizeSets` — the Card type declares
// `related?: RelatedCard[]` but the XML parser produces a single
// object when there's only one `<related>` sibling. Cast is safe
// because the parser always yields objects with `.value` even when
// it lies about the collection shape.
function normalizeRelated(
  field: RelatedCard[] | RelatedCard | undefined,
): RelatedCard[] {
  if (!field) return [];
  return Array.isArray(field) ? field : [field];
}

function readStringProp(node: unknown): string | undefined {
  if (isRecord(node) && typeof node.value === 'string') {
    const s = node.value.trim();
    return s || undefined;
  }
  return undefined;
}

function readNumberProp(node: unknown): number | undefined {
  const s = readStringProp(node);
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function splitColors(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  // Cockatrice packs colors as "W" / "WU" / "WUBRG". Split on chars.
  const out = raw
    .toUpperCase()
    .split('')
    .filter((c) => c === 'W' || c === 'U' || c === 'B' || c === 'R' || c === 'G');
  return out.length ? out : undefined;
}

// ---------- Scryfall ----------

interface ScryfallCard {
  id: string;
  name: string;
  layout?: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  set?: string;
  collector_number?: string;
  image_uris?: { small?: string; normal?: string; large?: string };
  /** Present on multi-faced cards (transform, modal_dfc,
   *  reversible_card, split, adventure, flip). Front-face is [0],
   *  back-face is [1]. Fields on each face largely mirror the
   *  top-level fields — for DFCs, top-level `name` is combined
   *  "A // B" while each face has its own single-face name. */
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    type_line?: string;
    colors?: string[];
    power?: string;
    toughness?: string;
    image_uris?: { small?: string; normal?: string };
  }>;
  /** Present on cards with related-object references — tokens
   *  created, meld halves, combo pieces (transform back-faces).
   *  See https://scryfall.com/docs/api/cards for the field spec. */
  all_parts?: Array<{
    id: string;
    component: 'token' | 'meld_part' | 'meld_result' | 'combo_piece';
    name: string;
    type_line?: string;
    uri: string;
  }>;
}

/** Strip a trailing "(Token)" / "Token" suffix — those don't resolve
 *  on Scryfall's exact-match endpoints. Shared by the single-card and
 *  batch paths so the same input normalizes consistently. */
function cleanScryfallName(name: string): string {
  return name.replace(/\s*\(?\bToken\b\)?\s*$/i, '');
}

async function fetchScryfall(name: string): Promise<ScryfallCard | null> {
  const cleaned = cleanScryfallName(name);
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cleaned)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as ScryfallCard;
  } catch {
    return null;
  }
}

/**
 * Batch resolve `names` through Scryfall's `/cards/collection` POST
 * endpoint (75 identifiers per request). Returns a Map keyed by
 * lowercased request name; missing entries mean Scryfall couldn't
 * match that name. On a chunk failure (network flake, non-2xx), the
 * chunk's cards silently drop out of the result — the caller renders
 * them as `lookupSource: 'unknown'` rows.
 */
async function batchFetchScryfall(names: string[]): Promise<Map<string, ScryfallCard>> {
  const out = new Map<string, ScryfallCard>();
  if (names.length === 0) return out;

  const CHUNK = 75;
  const requested = new Set(names.map((n) => n.toLowerCase()));
  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += CHUNK) {
    chunks.push(names.slice(i, i + CHUNK));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifiers: chunk.map((name) => ({ name })),
          }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          data?: ScryfallCard[];
          not_found?: Array<{ name?: string }>;
        };
        for (const card of body.data ?? []) {
          const key = card.name.toLowerCase();
          if (requested.has(key)) {
            out.set(key, card);
          }
          // Split cards resolve as "A // B"; also key by the first
          // face so callers who asked for that name alone still hit.
          const firstFace = key.split(' // ')[0];
          if (firstFace !== key && requested.has(firstFace)) {
            out.set(firstFace, card);
          }
        }
      } catch {
        // Chunk failed — leave those cards missing.
      }
    }),
  );

  return out;
}

/**
 * Return every Scryfall printing for `name` (exact match), sorted
 * newest-first. Used by the printings picker — Dexie only knows the
 * printings that were in the user's imported Cockatrice XML, which
 * for many cards is a single entry. Scryfall has the full history.
 *
 * Empty array on network error / 404 (Scryfall returns 404 for "no
 * matches") so the caller can degrade to `lookupCard(name).printings`
 * without a try/catch.
 */
export async function fetchAllPrintings(name: string): Promise<PrintingSummary[]> {
  const cleaned = name.replace(/\s*\(?\bToken\b\)?\s*$/i, '');
  // `!"…"` is Scryfall syntax for exact-name match (unquoted phrases
  // fuzzy-match). `unique=prints` returns one row per printing rather
  // than the default `cards` dedupe. `order=released` gives newest
  // first so the current-print heuristic (last in the list) still
  // reads intuitively in the grid.
  const q = `!"${cleaned.replace(/"/g, '\\"')}"`;
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=prints&order=released&dir=desc`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: ScryfallCard[] };
    return (body.data ?? []).map((c) => ({
      set: c.set,
      collectorNumber: c.collector_number,
      scryfallId: c.id,
      imageUri:
        c.image_uris?.normal ??
        c.image_uris?.small ??
        c.card_faces?.[0]?.image_uris?.normal ??
        c.card_faces?.[0]?.image_uris?.small,
    }));
  } catch {
    return [];
  }
}

function scryfallToLookup(card: ScryfallCard): LookupResult {
  // Extract related-card refs from Scryfall's `all_parts`. Filter to
  // `token` + `meld_part` + `meld_result` — these three components
  // have well-defined semantics (Scryfall creates them from the
  // card's rules text automatically and consistently).
  //
  // `combo_piece` is DELIBERATELY excluded: Scryfall's docs call it
  // "the specific relationship is unclear" and it doubles as a
  // grab-bag for any pair of cards that reference each other by
  // name. That produces false positives like Command Tower listing
  // Tower Winder as a related token (Tower Winder's text says
  // "search your library for Command Tower", so Scryfall bidir-
  // linked them). Cockatrice avoids this by pulling relations from
  // human-curated cards.xml `<related>` entries; we still honor
  // those via dexieToLookup, so users with cards.xml imported get
  // the curated transform/meld back-faces there. Users on pure
  // Scryfall lose transform-back-face menu items (Delver → Insectile
  // Aberration) but gain accuracy — false positives are worse than
  // missing niche entries.
  //
  // DFC front/back doesn't live in `all_parts` anyway — Scryfall
  // puts both faces in the parent card's `card_faces` array. That's
  // a separate concern from token creation.
  const relatedList: RelatedCardRef[] = [];
  if (card.all_parts) {
    const seen = new Set<string>();
    for (const part of card.all_parts) {
      if (
        !part.name
        || part.name === card.name
        || seen.has(part.name)
        || part.component === 'combo_piece'
      ) {
        continue;
      }
      seen.add(part.name);
      relatedList.push({
        name: part.name,
        component: part.component,
        origin: 'scryfall',
        scryfallId: part.id,
      });
    }
  }

  // Extract each face for multi-faced cards. Skips entries missing
  // a name (defensive — Scryfall always sets it for DFCs, but split
  // cards / adventures sometimes have partial face records).
  const faces: LookupCardFace[] | undefined = card.card_faces
    ? card.card_faces
      .filter((f) => !!f.name)
      .map((f) => ({
        name: f.name!,
        manaCost: f.mana_cost,
        typeLine: f.type_line,
        colors: f.colors,
        power: f.power,
        toughness: f.toughness,
        imageUri: f.image_uris?.normal ?? f.image_uris?.small,
      }))
    : undefined;

  return {
    found: true,
    source: 'scryfall',
    name: card.name,
    typeLine: card.type_line,
    manaCost: card.mana_cost,
    cmc: card.cmc,
    colors: card.colors && card.colors.length ? card.colors : card.color_identity,
    power: card.power,
    toughness: card.toughness,
    printings: [
      {
        set: card.set,
        collectorNumber: card.collector_number,
        scryfallId: card.id,
        imageUri:
          card.image_uris?.normal ??
          card.image_uris?.small ??
          card.card_faces?.[0]?.image_uris?.normal ??
          card.card_faces?.[0]?.image_uris?.small,
      },
    ],
    related: relatedList.length > 0 ? relatedList : undefined,
    layout: card.layout,
    faces: faces && faces.length > 0 ? faces : undefined,
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
