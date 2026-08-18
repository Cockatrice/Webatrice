/**
 * Card name search for the deck editor's QuickAdd dropdown.
 *
 * Uses Scryfall's `/cards/autocomplete` endpoint, which returns up to
 * 20 card names ordered by relevance (substring + fuzzy match, not
 * strict prefix). This matches fancy webatrice's behavior — typing
 * "risen" surfaces "Risen Reef", "Risen Riptide", etc. rather than
 * "Arisen Gorgon" first.
 *
 * We deliberately do not fall back to Dexie prefix search here:
 *   - Dexie can only do prefix matches cheaply (`startsWithIgnoreCase`),
 *     so it would sort "Arisen …" ahead of "Risen …" — the exact bug
 *     we're fixing.
 *   - Autocomplete is fast (a single small JSON payload) and correct.
 *   - The dropdown only needs the name; hydration happens later, at
 *     which point Dexie is consulted first via `cardLookup.ts`.
 */

export interface SearchResult {
  name: string;
  source: 'scryfall';
}

const MIN_QUERY = 2;

export async function searchCards(query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY) return [];

  const url = `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: string[] };
    return (body.data ?? []).slice(0, limit).map((name) => ({ name, source: 'scryfall' }));
  } catch {
    return [];
  }
}

/**
 * Rich Scryfall card shape used by the advanced-search results grid.
 * Superset of what the printings picker needs — we surface image_uris,
 * type_line, mana_cost, set, and collector so the tile can render a
 * card image with proper labels without a second fetch.
 */
export interface ScryfallSearchCard {
  id: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  set?: string;
  collector_number?: string;
  image_uris?: { small?: string; normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>;
}

/**
 * Full-fat Scryfall search (as opposed to `/cards/autocomplete` used by
 * QuickAdd). Accepts Scryfall's full query syntax so filter clauses
 * like `c:wu`, `t:creature`, `cmc<=3`, `o:"draw a card"` all compose
 * into the same request. Aborts cleanly via AbortController so the
 * caller can cancel in-flight requests when the user keeps typing.
 */
export async function searchScryfallCards(
  query: string,
  signal?: AbortSignal,
): Promise<ScryfallSearchCard[]> {
  const q = query.trim();
  if (!q) return [];
  // `unique=cards` collapses printings so each card appears once, which
  // matches how the printings picker layers on top of a search result.
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=name`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return []; // 404 = zero matches; treat as empty
    const body = (await res.json()) as { data?: ScryfallSearchCard[] };
    return body.data ?? [];
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    return [];
  }
}
