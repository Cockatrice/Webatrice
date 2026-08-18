import type { DeckCard } from './types';

/**
 * Scryfall price lookup for deck totals + per-card "Buy @ TCGplayer"
 * pills. Uses `/cards/collection` (POST, up to 75 identifiers per
 * request) with an in-memory Map cache so repeated calls in the same
 * session don't re-fetch the same items.
 *
 * Cards can be identified two ways:
 *   • by `scryfallId` — precise, returns the exact printing's price
 *   • by lowercased `name` — Scryfall returns the default printing's
 *     price when the caller doesn't know the exact printing
 *
 * The latter covers Cockatrice-authored .cod files (bare
 * `<card name="…"/>` with no `uuid` attribute) and any Dexie hits
 * whose imported card DB is too old to carry Scryfall UUIDs. Without
 * this fallback, those decks would show `$0.00` even when Scryfall
 * has perfectly good prices on file.
 */

export interface PriceInfo {
  /** TCGplayer USD, non-foil. `null` when Scryfall has no price on
   *  file for this printing (out-of-print, promos, etc.). */
  usd: number | null;
  /** Scryfall's affiliate purchase URL for TCGplayer. Landing page
   *  for the printing. `null` when Scryfall doesn't have one. */
  tcgplayer: string | null;
}

/** Result of a bulk price fetch. Callers look up a card via
 *  `priceForCard(lookup, card)` rather than reading maps directly,
 *  so the id-first / name-fallback logic stays in one place. */
export interface PriceLookup {
  byId: Map<string, PriceInfo>;
  byName: Map<string, PriceInfo>;
}

export function emptyPriceLookup(): PriceLookup {
  return { byId: new Map(), byName: new Map() };
}

/** Look up a card's price. Prefers exact scryfallId when the card
 *  carries one AND that printing has a real price; falls back to name
 *  (case-insensitive) when either the id isn't in the lookup or the
 *  id's specific printing has no `usd` on file (foil-only reprints,
 *  old dual-land printings, promo-only prints — Scryfall genuinely
 *  doesn't have a paper price for those). Returns undefined when
 *  neither source knows the card. */
export function priceForCard(
  lookup: PriceLookup,
  card: { scryfallId?: string; name: string },
): PriceInfo | undefined {
  if (card.scryfallId) {
    const byId = lookup.byId.get(card.scryfallId);
    // Fall through to the name lookup when the exact printing has no
    // price on file — the default printing typically does.
    if (byId && byId.usd != null) return byId;
  }
  const byName = lookup.byName.get(card.name.toLowerCase());
  if (byName) return byName;
  // No name hit — surface whatever the id lookup returned even if it
  // was priceless, so downstream sees "we tried and got nothing" vs
  // "we haven't tried yet".
  if (card.scryfallId) return lookup.byId.get(card.scryfallId);
  return undefined;
}

interface ScryfallCollectionCard {
  id: string;
  name: string;
  prices?: { usd?: string | null };
  purchase_uris?: { tcgplayer?: string | null };
}

interface Identifier {
  id?: string;
  name?: string;
}

// Session-wide caches. Never expire — Scryfall's price data changes
// slowly and a full page reload clears these anyway. Separate maps so
// id-based and name-based cache entries don't collide.
const idCache = new Map<string, PriceInfo>();
const nameCache = new Map<string, PriceInfo>();

// In-flight de-dup: keyed by `id:<uuid>` / `name:<lower>` so parallel
// callers coalesce onto the same request.
const inFlight = new Map<string, Promise<void>>();

const COLLECTION_ENDPOINT = 'https://api.scryfall.com/cards/collection';
const MAX_PER_REQUEST = 75;

/**
 * Fetch prices for a set of cards. Each card contributes an
 * identifier: `scryfallId` when present (precise printing), else
 * lowercased `name` (Scryfall picks the default printing). Cards
 * already in cache are skipped; only new ones hit the network.
 */
/**
 * Bulk price fetch with optional per-chunk progress reporting.
 *
 * `onProgress` fires immediately with whatever's already in the cache
 * (so the caller can paint stale-but-real prices right away), then
 * after every subsequent chunk resolves with the accumulated lookup.
 * The returned promise resolves to the same final lookup as the last
 * onProgress emission. Useful for showing the deck total counting up
 * as Scryfall responses arrive on decks big enough to need multiple
 * batches.
 */
export async function fetchPricesForCards(
  cards: ReadonlyArray<{ scryfallId?: string; name: string }>,
  onProgress?: (partial: PriceLookup) => void,
): Promise<PriceLookup> {
  const idsSeen = new Set<string>();
  const namesSeen = new Set<string>();
  const identifiers: Identifier[] = [];
  const cacheKeys: string[] = [];

  // For each card, request the exact printing (`{id}`) when known AND
  // the name (`{name}`) unconditionally. Two reasons for the name-
  // even-when-id-is-known request:
  //   1. Fallback data. Cards imported from a .cod may point at a
  //      specific printing (foil-only reprint, old dual, promo) with
  //      no `prices.usd` on file. `priceForCard` transparently falls
  //      back to the default-printing name price in that case, but
  //      only if the name entry is in the cache.
  //   2. `computeDeckPrice` for the deck-total uses whichever price
  //      priceForCard returns — the fallback makes totals accurate
  //      for imported decks with random exotic uuids.
  for (const card of cards) {
    if (card.scryfallId && !idsSeen.has(card.scryfallId)) {
      idsSeen.add(card.scryfallId);
      if (!idCache.has(card.scryfallId)) {
        identifiers.push({ id: card.scryfallId });
        cacheKeys.push(`id:${card.scryfallId}`);
      }
    }
    if (card.name) {
      const nameKey = card.name.toLowerCase();
      if (!namesSeen.has(nameKey)) {
        namesSeen.add(nameKey);
        if (!nameCache.has(nameKey)) {
          identifiers.push({ name: card.name });
          cacheKeys.push(`name:${nameKey}`);
        }
      }
    }
  }

  // Partition into pending-in-flight vs actually-need-to-fetch, so we
  // don't spawn a duplicate request for keys already being fetched by
  // another caller.
  const toFetch: Identifier[] = [];
  const waitingOn: Array<Promise<void>> = [];
  for (let i = 0; i < identifiers.length; i++) {
    const key = cacheKeys[i];
    const pending = inFlight.get(key);
    if (pending) {
      waitingOn.push(pending);
    } else {
      toFetch.push(identifiers[i]);
    }
  }

  // Assemble a PriceLookup from the current cache for the caller's
  // exact card set. Reused for streaming progress emissions.
  const assemble = (): PriceLookup => {
    const out = emptyPriceLookup();
    for (const card of cards) {
      if (card.scryfallId) {
        const info = idCache.get(card.scryfallId);
        if (info) out.byId.set(card.scryfallId, info);
      }
      if (card.name) {
        const nk = card.name.toLowerCase();
        const info = nameCache.get(nk);
        if (info) out.byName.set(nk, info);
      }
    }
    return out;
  };

  // Initial emission — paints anything already cached from a prior
  // render or a previous printings-picker fetch, so the sidebar's
  // total isn't stuck at $0.00 while we wait for network.
  onProgress?.(assemble());

  if (toFetch.length > 0) {
    for (let i = 0; i < toFetch.length; i += MAX_PER_REQUEST) {
      const chunk = toFetch.slice(i, i + MAX_PER_REQUEST);
      const chunkPromise = fetchChunk(chunk).then((res) => {
        for (const [id, info] of res.byId) idCache.set(id, info);
        for (const [name, info] of res.byName) nameCache.set(name, info);
        // Only negative-cache on a SUCCESSFUL response — otherwise a
        // single failed chunk (network flake, timeout, 500 from
        // Scryfall) would permanently poison the cache for those 75
        // cards, silently making them look priceless for the whole
        // session. Scryfall's response includes explicit `not_found`
        // identifiers when the request succeeded but some inputs
        // didn't match; we log those to the console so mismatches
        // are diagnosable without a UI drill-down.
        if (res.ok) {
          for (const ident of chunk) {
            if (ident.name && !res.byName.has(ident.name.toLowerCase())) {
              nameCache.set(ident.name.toLowerCase(), { usd: null, tcgplayer: null });
            }
            if (ident.id && !res.byId.has(ident.id)) {
              idCache.set(ident.id, { usd: null, tcgplayer: null });
            }
          }
          if (res.notFound.length > 0) {
            console.warn(
              `[pricing] Scryfall couldn't match ${res.notFound.length} identifier(s):`,
              res.notFound,
            );
          }
        } else {
          console.warn(
            `[pricing] Scryfall /cards/collection chunk failed (${chunk.length} identifiers). ` +
              'Cards left unpriced for this render; will retry on next fetch.',
          );
        }
      });
      const chunkKeys = chunk.map((ident) =>
        ident.id ? `id:${ident.id}` : `name:${(ident.name ?? '').toLowerCase()}`,
      );
      for (const k of chunkKeys) inFlight.set(k, chunkPromise);
      try {
        await chunkPromise;
        onProgress?.(assemble());
      } finally {
        for (const k of chunkKeys) inFlight.delete(k);
      }
    }
  }

  await Promise.all(waitingOn);
  const final = assemble();
  onProgress?.(final);
  return final;
}

/** Result of one `/cards/collection` chunk request. `ok=false` when
 *  the network call itself failed OR Scryfall returned non-2xx — the
 *  caller uses this to distinguish "genuinely not found" (should
 *  negative-cache) from "we don't know yet" (leave the cache alone so
 *  the next render retries). */
interface ChunkResult extends PriceLookup {
  ok: boolean;
  /** Identifiers Scryfall explicitly reported as unmatched. Only
   *  populated when `ok=true`. */
  notFound: Identifier[];
}

async function fetchChunk(identifiers: Identifier[]): Promise<ChunkResult> {
  const empty: ChunkResult = { ...emptyPriceLookup(), ok: false, notFound: [] };
  try {
    const res = await fetch(COLLECTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    });
    if (!res.ok) return empty;
    const body = (await res.json()) as {
      data?: ScryfallCollectionCard[];
      not_found?: Identifier[];
    };
    const out: ChunkResult = {
      ...emptyPriceLookup(),
      ok: true,
      notFound: body.not_found ?? [],
    };
    // Build a set of the names we asked for so we can populate the
    // name cache using the requested name (Scryfall may return a
    // slightly different `name` field for split cards etc.; we key
    // by what we asked for so future lookups hit).
    const requestedNames = new Set(
      identifiers.filter((i) => i.name).map((i) => i.name!.toLowerCase()),
    );
    for (const card of body.data ?? []) {
      const info: PriceInfo = {
        usd: card.prices?.usd ? Number(card.prices.usd) : null,
        tcgplayer: card.purchase_uris?.tcgplayer ?? null,
      };
      out.byId.set(card.id, info);
      const returnedName = card.name.toLowerCase();
      if (requestedNames.has(returnedName)) {
        out.byName.set(returnedName, info);
      }
      // Split card names come back as "A // B" from Scryfall; also
      // key by the first face if a caller asked for that name alone.
      const firstFace = returnedName.split(' // ')[0];
      if (firstFace !== returnedName && requestedNames.has(firstFace)) {
        out.byName.set(firstFace, info);
      }
    }
    return out;
  } catch (e) {
    console.warn('[pricing] Scryfall fetch threw:', e);
    return empty;
  }
}

/**
 * Reduce a deck's rows + a price lookup into `{ total, missing }`.
 * `total` is USD (rounded to 2 decimals downstream by the caller —
 * we keep full precision here). `missing` is the sum-of-quantities
 * for rows Scryfall couldn't price by either scryfallId or name.
 */
export function computeDeckPrice(
  cards: DeckCard[],
  prices: PriceLookup,
): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const card of cards) {
    const info = priceForCard(prices, card);
    const usd = info?.usd;
    if (usd != null && Number.isFinite(usd)) {
      total += usd * card.quantity;
    } else {
      missing += card.quantity;
    }
  }
  return { total, missing };
}

/**
 * Build TCGplayer's Mass Entry cart URL for the whole deck. TCGplayer's
 * parser is fussy: `||` between entries (literal, not encoded), `%20`
 * for spaces (not `+`), apostrophes and `!` must stay literal. Building
 * by hand keeps those quirks under our control.
 */
export function buildTcgMassEntryUrl(cards: DeckCard[]): string {
  const entries = cards
    .filter((c) => c.quantity > 0 && c.name)
    .map((c) => {
      const parts: string[] = [`${c.quantity}%20${encodeToken(c.name)}`];
      if (c.set) parts.push(`%5B${c.set.toUpperCase()}%5D`);
      if (c.collectorNumber) parts.push(encodeToken(c.collectorNumber));
      return parts.join('%20');
    })
    .join('||');
  return `https://www.tcgplayer.com/massentry?c=${entries}&productline=Magic`;
}

function encodeToken(s: string): string {
  return encodeURIComponent(s)
    .replace(/%27/g, "'")
    .replace(/%21/g, '!');
}
