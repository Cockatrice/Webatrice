import { dexieService, type Card, type CardInSet } from '@app/services';
import { ScryfallImageSize } from '@cockatrice/datatrice';

/**
 * Card DB lookup helpers for the decks feature. Dexie's `cards` table
 * (populated by the user's imported Cockatrice card XML) is the
 * primary source. On cache miss we fall back to Scryfall's
 * `/cards/named?exact=` endpoint — that's the "reconstruction adds
 * value" path from the plan.
 *
 * We deliberately do NOT upsert the Scryfall response into the Dexie
 * `cards` table: that table's shape is Cockatrice-XML-derived and
 * squeezing a Scryfall record into it is lossy. A dedicated
 * `deckCardCache` table can come in a later piece if performance
 * demands it (right now we're only doing one network call per unique
 * unknown card per session).
 */

/** Unified result shape returned by all `lookup*` functions. Callers
 *  can render straight from this without switching on the source. */
export interface LookupResult {
  found: boolean;
  source: 'dexie' | 'scryfall' | 'unknown';
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
}

export interface PrintingSummary {
  set?: string;
  collectorNumber?: string;
  scryfallId?: string;
  imageUri?: string;
}

/**
 * Look up a single card by name. Dexie first, Scryfall on miss,
 * `{ found: false, source: 'unknown', ... }` if neither has it.
 * Names should be exact (case-insensitive match handled internally).
 */
export async function lookupCard(name: string): Promise<LookupResult> {
  const dexieHit = await getFromDexie(name);
  if (dexieHit) return dexieToLookup(dexieHit);

  const scryfallHit = await fetchScryfall(name);
  if (scryfallHit) return scryfallToLookup(scryfallHit);

  return { found: false, source: 'unknown', name, printings: [] };
}

/**
 * Batch version: one Dexie `bulkGet` for cache hits, then Scryfall
 * `/cards/collection` (POST, 75 identifiers per request) for the
 * misses. Returns a Map keyed by input name for O(1) lookups by the
 * caller.
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
 * Motivation: `lookupCards` deliberately does NOT persist Scryfall
 * results into Dexie (Dexie's schema is Cockatrice-XML-derived and
 * squeezing a Scryfall record in is lossy — see the file header). But
 * within a single session, the same card names come up over and over
 * (repeated reveals, repeated View library, opponent-reveal after
 * you've already loaded your own deck). Re-hitting Scryfall for
 * cached names is pure waste.
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

  const dexieHits = await bulkGetFromDexie(uniqueNames);

  const missing: string[] = [];
  for (let i = 0; i < uniqueNames.length; i++) {
    const key = uniqueNames[i];
    const hit = dexieHits[i];
    if (hit) {
      out.set(key, dexieToLookup(hit));
    } else {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    // Track the request name → the cleaned name we actually sent to
    // Scryfall (the "(Token)" suffix stripper). Scryfall's response
    // echoes the resolved name, not our input, so we key the output
    // by the original request name via this indirection.
    const cleanedByRequest = new Map<string, string>();
    for (const name of missing) {
      cleanedByRequest.set(name, cleanScryfallName(name));
    }
    const collected = await batchFetchScryfall(
      Array.from(new Set(cleanedByRequest.values())),
    );
    for (const name of missing) {
      const cleaned = cleanedByRequest.get(name)!;
      const hit = collected.get(cleaned.toLowerCase());
      out.set(
        name,
        hit ? scryfallToLookup(hit) : { found: false, source: 'unknown', name, printings: [] },
      );
    }
  }

  return out;
}

// ---------- Dexie ----------

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
  };
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

function normalizeSets(setField: Card['set']): CardInSet[] {
  // Cockatrice XML collapses single-element repeated tags to a
  // scalar; `set` can be one printing or many.
  if (!setField) return [];
  return Array.isArray(setField) ? setField : [setField];
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
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>;
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
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
