import { cardOverride, currentCardDataPreferences, type CardDataPreferences } from '../../cardDatabase';
import { fetchCollection, fetchNamedCard, fetchPrintings, SCRYFALL_NAMED_RETRY_CAP } from '../../scryfall/client';
import { throwIfAborted } from '../../scryfall/scheduler';
import { bulkGetFromDexie, dexieToLookup, getFromDexie } from './dexieCardMapper';
import {
  bulkGetFromScryfallCache,
  bulkPutScryfallCache,
  getFromScryfallCache,
  isScryfallCacheFresh,
  matchesHint,
  putScryfallCache,
} from './scryfallCache';
import { scryfallToLookup } from './scryfallCardMapper';
import type { LookupHint, LookupInput, LookupResult, PrintingSummary, RelatedCardRef } from './types';

async function fetchForLookup<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request;
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      throw error;
    }
    return undefined;
  }
}

/**
 * Look up a single card by name. Merges Dexie cards.xml data (if we
 * have the card) with Scryfall data (from persistent cache, else
 * network fetch). Falls back to `{ found: false, source: 'unknown',
 * ... }` if neither source knows the card. Names should be exact
 * (case-insensitive match handled internally by Dexie's primary key
 * / Scryfall's exact endpoint).
 */
export async function lookupCard(name: string, signal?: AbortSignal): Promise<LookupResult> {
  throwIfAborted(signal);
  const [xmlHit, scryfallCached, preferences] = await Promise.all([
    getFromDexie(name),
    getFromScryfallCache(name),
    readCardDataPreferences(),
  ]);
  throwIfAborted(signal);
  const xmlLookup = xmlHit ? dexieToLookup(xmlHit, preferences) : undefined;

  let scryfallLookup = scryfallCached;
  if (!scryfallLookup || !isScryfallCacheFresh(scryfallLookup)) {
    const fetched = await fetchForLookup(fetchNamedCard(name, signal));
    if (fetched) {
      scryfallLookup = { ...scryfallToLookup(fetched), fetchedAt: Date.now() };
      // Write-through to the persistent cache. Fire-and-forget —
      // a stalled Dexie write shouldn't hold up the caller.
      void putScryfallCache(scryfallLookup);
    }
  }

  const result = mergeLookup(name, xmlLookup, scryfallLookup);
  const pins = await resolvePins([result], [scryfallCached, scryfallLookup], preferences, signal);
  return applyPin(result, pins.get(result.name));
}

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
const hydrationOnlyResults = new WeakSet<LookupResult>();

let sessionCachePreferences: CardDataPreferences | undefined;

async function readCardDataPreferences(): Promise<CardDataPreferences | undefined> {
  try {
    const preferences = await currentCardDataPreferences();
    if (preferences !== sessionCachePreferences) {
      sessionCache.clear();
      sessionCachePreferences = preferences;
    }
    return preferences;
  } catch {
    return undefined;
  }
}

export async function lookupCardsCached(
  names: string[], signal?: AbortSignal, allowStale = false,
): Promise<Map<string, LookupResult>> {
  throwIfAborted(signal);
  const out = new Map<string, LookupResult>();
  const missing: string[] = [];
  const preferences = await readCardDataPreferences();
  throwIfAborted(signal);
  for (const name of names) {
    const cached = sessionCache.get(name);
    const fresh = cached && !hydrationOnlyResults.has(cached)
      && ((cached.source === 'dexie' && cached.fetchedAt === undefined) || isScryfallCacheFresh(cached));
    if (cached && (allowStale || fresh)) {
      out.set(name, cached);
    } else {
      missing.push(name);
    }
  }
  if (missing.length === 0) {
    return out;
  }
  const fresh = await lookupCards(missing, signal);
  const canRemember = preferences === await readCardDataPreferences();
  for (const [name, result] of fresh) {
    out.set(name, result);
    if (canRemember && result.source !== 'unknown') {
      sessionCache.set(name, result);
    }
  }
  return out;
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
export async function lookupCards(
  input: LookupInput[],
  signal?: AbortSignal,
): Promise<Map<string, LookupResult>> {
  throwIfAborted(signal);
  const out = new Map<string, LookupResult>();
  // Normalize to `LookupHint`, deduped by name (first hint wins if a
  // caller passes the same name twice with conflicting printing
  // hints — arbitrary but stable). Returned Map is keyed by name so
  // callers can still `.get(name)` regardless of whether they passed
  // strings or hints.
  const uniqueHints = new Map<string, LookupHint>();
  for (const item of input) {
    const hint = typeof item === 'string' ? { name: item } : item;
    if (hint.name && !uniqueHints.has(hint.name)) {
      uniqueHints.set(hint.name, hint);
    }
  }
  if (uniqueHints.size === 0) {
    return out;
  }

  const hints = Array.from(uniqueHints.values());
  const local = await readLocalLookups(hints, signal);

  // Names we still need to fetch from Scryfall. Any name without a
  // scryfallCache hit — regardless of whether cards.xml has it —
  // because we want Scryfall's `all_parts` list for the related-
  // tokens menu.
  const needScryfall = hints.filter((hint) => local.get(printingKey(hint))!.needsRefresh);
  const fetched = await fetchLookupBatch(needScryfall, signal);
  for (const hint of hints) {
    const entry = local.get(printingKey(hint))!;
    const refreshed = fetched.get(hint.name);
    out.set(hint.name, refreshed ? applyPin(mergeHintedPrintingLookup(hint, entry.xml, refreshed), entry.pin) : entry.matchedLookup);
  }

  return completePins(out, signal);
}

export function printingKey(hint: LookupHint): string {
  return JSON.stringify([hint.name, hint.set?.toLowerCase() ?? '', hint.collectorNumber ?? '', hint.scryfallId ?? '']);
}

export function printingRounds(hints: readonly LookupHint[]): LookupHint[][] {
  const rounds: LookupHint[][] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    const key = printingKey(hint);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const round = rounds.find((r) => !r.some((other) => other.name === hint.name));
    if (round) {
      round.push(hint);
    } else {
      rounds.push([hint]);
    }
  }
  return rounds;
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
export async function fetchAllPrintings(name: string, signal?: AbortSignal): Promise<PrintingSummary[]> {
  const cards = await fetchPrintings(name, signal);
  try {
    return cards.map((c) => ({
      name: c.name,
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
      ? { ...s, count: x.count ?? s.count, persistent: x.persistent ?? s.persistent, attach: x.attach ?? s.attach, exclude: x.exclude }
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
    fetchedAt: scryfall!.fetchedAt,
    colorIdentity: xml!.colorIdentity ?? scryfall!.colorIdentity,
    related: overlaid.length > 0 ? overlaid : undefined,
    // Layout + faces only live on Scryfall records (cards.xml
    // doesn't carry them), so pull directly from that side without
    // any merging logic. Powers the "Transform into …" menu item.
    layout: scryfall!.layout,
    faces: scryfall!.faces,
    text: xml!.text ?? scryfall!.text,
    landscape: xml!.landscape || scryfall!.landscape,
    legalities: xml!.legalities ?? scryfall!.legalities,
  };
}

async function fetchLookupBatch(hints: LookupHint[], signal?: AbortSignal): Promise<Map<string, LookupResult>> {
  const scryfallLookups = new Map<string, LookupResult>();
  if (hints.length > 0) {
    const collected = await fetchForLookup(fetchCollection(hints, signal));
    const toCache: LookupResult[] = [];
    for (const hint of hints) {
      const hit = collected?.get(hint.name);
      if (hit) {
        const parsed = { ...scryfallToLookup(hit), fetchedAt: Date.now() };
        scryfallLookups.set(hint.name, parsed);
        toCache.push(parsed);
      }
    }
    // Retry batch misses individually via `/cards/named?exact=`. The
    // batch `/cards/collection` endpoint silently drops names it can't
    // resolve (e.g. odd Unicode variants, network partial failures),
    // which for zone-view flows like an opponent's revealed library
    // would leave most cards with `typeLine=null` and bucket every
    // creature under "Other" in the group-by-type view. The individual
    // endpoint has more permissive matching so a second pass usually
    // recovers what the batch missed. Capped at 50 to avoid a
    // self-inflicted DoS when the batch endpoint fails wholesale —
    // 700 concurrent /cards/named calls would blow past Scryfall's
    // recommended rate limit and be actively slower than a single
    // clean batch failure. If more than 50 names are unresolved, the
    // batch is broken for reasons individual calls won't fix and we
    // give up gracefully; the console.warn on the batch failure is
    // the actionable signal.
    const stillMissing = hints.filter(
      (h) => collected && !collected.has(h.name) && !h.scryfallId && !h.set && !h.collectorNumber,
    );
    if (stillMissing.length > 0 && stillMissing.length <= SCRYFALL_NAMED_RETRY_CAP) {
      const retried = await Promise.all(
        stillMissing.map((h) => fetchForLookup(fetchNamedCard(h.name, signal))),
      );
      for (let i = 0; i < stillMissing.length; i++) {
        const hit = retried[i];
        if (hit) {
          const parsed = { ...scryfallToLookup(hit), fetchedAt: Date.now() };
          scryfallLookups.set(stillMissing[i].name, parsed);
          toCache.push(parsed);
        }
      }
    } else if (stillMissing.length > SCRYFALL_NAMED_RETRY_CAP) {
      console.warn(
        `Skipping per-name Scryfall retry: ${stillMissing.length} names unresolved (over ${SCRYFALL_NAMED_RETRY_CAP}-name cap).`
        + ' Batch endpoint likely failed wholesale; individual retries would exceed Scryfall rate limits.',
      );
    }
    if (toCache.length > 0) {
      // Fire-and-forget. Cache misses on write don't affect the
      // return value — we've already got the parsed data in-hand.
      void bulkPutScryfallCache(toCache);
    }
  }

  return scryfallLookups;
}

let lookupRevision = 0;
const lookupListeners = new Set<() => void>();

export function subscribeCardLookups(listener: () => void): () => void {
  lookupListeners.add(listener);
  return () => {
    lookupListeners.delete(listener);
  };
}

export function cardLookupRevision(): number {
  return lookupRevision;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) => {
    if (key === 'fetchedAt') {
      return undefined;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
}

function rememberHydration(lookups: ReadonlyMap<string, LookupResult>, hints: readonly LookupHint[]): void {
  let changed = false;
  for (const hint of hints) {
    const lookup = lookups.get(printingKey(hint));
    if (lookup) {
      changed ||= fingerprint(sessionCache.get(hint.name)) !== fingerprint(lookup);
      sessionCache.set(hint.name, lookup);
    }
  }
  if (changed) {
    lookupRevision++;
    lookupListeners.forEach((listener) => listener());
  }
}

function mergeHintedPrintingLookup(
  hint: LookupHint, xml: LookupResult | undefined, scryfall: LookupResult | undefined,
): LookupResult {
  const result = mergeLookup(hint.name, xml, scryfall);
  if (!xml || !scryfall || !(hint.scryfallId || hint.set || hint.collectorNumber)) {
    return result;
  }
  const printings = [...xml.printings];
  for (const printing of scryfall.printings.filter((candidate) => matchesHint([candidate], hint))) {
    const index = printings.findIndex((item) => printing.scryfallId && item.scryfallId
      ? printing.scryfallId === item.scryfallId
      : printing.set?.toLowerCase() === item.set?.toLowerCase() && printing.collectorNumber === item.collectorNumber);
    if (index < 0) {
      printings.push(printing);
    } else {
      printings[index] = { ...printing, ...printings[index],
        imageUri: printings[index].imageUri ?? printing.imageUri,
        imageUris: printings[index].imageUris?.length ? printings[index].imageUris : printing.imageUris,
      };
    }
  }
  return { ...result, printings };
}

interface LocalCardLookup {
  xml: LookupResult | undefined;
  lookup: LookupResult;
  matchedLookup: LookupResult;
  needsRefresh: boolean;
  pin?: CardPin;
}

interface CardPin {
  id: string;
  card?: LookupResult;
  printing?: PrintingSummary;
}

async function resolvePins(
  cards: LookupResult[], cached: Array<LookupResult | undefined>,
  preferences: CardDataPreferences | undefined, signal?: AbortSignal, fetchMissing = true,
): Promise<Map<string, CardPin>> {
  const pins = new Map<string, CardPin>();
  const missing: LookupHint[] = [];
  for (const card of cards) {
    const id = cardOverride(preferences?.cardOverrides, card.name);
    if (!id || pins.has(card.name)) {
      continue;
    }
    const cachedCard = cached.find((entry) => entry?.name === card.name
      && entry.printings.some((printing) => printing.scryfallId === id));
    const printing = card.printings.find((entry) => entry.scryfallId === id)
      ?? cachedCard?.printings.find((entry) => entry.scryfallId === id);
    pins.set(card.name, { id, printing });
    if (!printing) {
      missing.push({ name: card.name, scryfallId: id });
    }
  }
  if (missing.length && fetchMissing) {
    const fetched = await fetchForLookup(fetchCollection(missing, signal));
    throwIfAborted(signal);
    const toCache: LookupResult[] = [];
    for (const hint of missing) {
      const hit = fetched?.get(hint.name);
      if (hit?.id === hint.scryfallId && hit.name === hint.name) {
        const card = { ...scryfallToLookup(hit), fetchedAt: Date.now() };
        pins.set(hint.name, { id: hit.id, card, printing: card.printings.find((printing) => printing.scryfallId === hit.id) });
        const previous = cached.find((entry) => entry?.name === card.name);
        toCache.push(previous ? { ...previous, printings: [...previous.printings, ...card.printings] } : card);
      }
    }
    await bulkPutScryfallCache(toCache);
  }
  return pins;
}

function applyPin(card: LookupResult, pin?: CardPin): LookupResult {
  if (!pin) {
    return card;
  }
  const base = !card.found && pin.card ? pin.card : card;
  const printings = pin.printing && !base.printings.some((printing) => printing.scryfallId === pin.id)
    ? [...base.printings, pin.printing] : base.printings;
  return { ...base, printings, pinnedPrintingId: pin.id };
}

async function completePins(
  lookups: Map<string, LookupResult>, signal?: AbortSignal,
): Promise<Map<string, LookupResult>> {
  const preferences = await readCardDataPreferences();
  for (const [key, card] of lookups) {
    if (card.pinnedPrintingId && card.pinnedPrintingId !== cardOverride(preferences?.cardOverrides, card.name)) {
      const unpinned = { ...card };
      delete unpinned.pinnedPrintingId;
      lookups.set(key, unpinned);
    }
  }
  const wanted = [...lookups.values()].filter((card) => cardOverride(preferences?.cardOverrides, card.name)
    && (!card.pinnedPrintingId || !card.printings.some((printing) => printing.scryfallId === card.pinnedPrintingId)));
  if (!wanted.length) {
    return lookups;
  }
  const cached = await bulkGetFromScryfallCache(wanted.map((card) => card.name));
  const pins = await resolvePins(wanted, cached, preferences, signal);
  return new Map([...lookups].map(([key, card]) => [key, applyPin(card, pins.get(card.name))]));
}

async function readLocalLookups(
  hints: readonly LookupHint[], signal?: AbortSignal,
): Promise<Map<string, LocalCardLookup>> {
  throwIfAborted(signal);
  const names = [...new Set(hints.map((hint) => hint.name))];
  const [xmlHits, cached, preferences] = await Promise.all([
    bulkGetFromDexie(names), bulkGetFromScryfallCache(names), readCardDataPreferences(),
  ]);
  throwIfAborted(signal);
  const xml = new Map(names.map((name, index) => [name, xmlHits[index] ? dexieToLookup(xmlHits[index]!, preferences) : undefined]));
  const scryfall = new Map(names.map((name, index) => [name, cached[index]]));
  const pins = await resolvePins(
    names.map((name) => mergeLookup(name, xml.get(name), scryfall.get(name))), cached, preferences, signal, false,
  );
  return new Map(hints.map((hint) => {
    const xmlLookup = xml.get(hint.name);
    const cachedLookup = scryfall.get(hint.name);
    const matching = cachedLookup && matchesHint(cachedLookup.printings, hint) ? cachedLookup : undefined;
    const pin = pins.get((xmlLookup ?? cachedLookup)?.name ?? hint.name);
    const lookup = applyPin(mergeHintedPrintingLookup(hint, xmlLookup, cachedLookup), pin);
    return [printingKey(hint), {
      xml: xmlLookup,
      lookup,
      pin,
      matchedLookup: matching ? lookup : applyPin(mergeHintedPrintingLookup(hint, xmlLookup, undefined), pin),
      needsRefresh: !matching || !isScryfallCacheFresh(matching),
    }];
  }));
}

export interface HydrationLookups {
  lookups: Map<string, LookupResult>;
  refreshed: Promise<Map<string, LookupResult>>;
}

export async function lookupCardsForHydration(input: LookupInput[], signal?: AbortSignal): Promise<HydrationLookups> {
  throwIfAborted(signal);
  const preferences = await readCardDataPreferences();
  const hints = [...new Map(input.map((item) => {
    const hint = typeof item === 'string' ? { name: item } : item;
    return [printingKey(hint), hint] as const;
  })).values()].filter((hint) => hint.name);
  const local = await readLocalLookups(hints, signal);
  const lookups = new Map<string, LookupResult>();
  const missing: LookupHint[] = [];
  const stale: LookupHint[] = [];
  for (const hint of hints) {
    const entry = local.get(printingKey(hint))!;
    lookups.set(printingKey(hint), entry.lookup);
    if (!entry.lookup.found) {
      missing.push(hint);
    } else if (entry.needsRefresh || (entry.pin && !entry.pin.printing)) {
      stale.push(hint);
    }
  }
  const fetchHints = async (wanted: LookupHint[], abort?: AbortSignal) => {
    const needsData = wanted.filter((hint) => local.get(printingKey(hint))!.needsRefresh);
    const batches = await Promise.all(printingRounds(needsData).map(async (round) => {
      const found = await fetchLookupBatch(round, abort);
      return round.flatMap((hint) => {
        const hit = found.get(hint.name);
        const entry = local.get(printingKey(hint))!;
        return hit ? [[printingKey(hint), applyPin(mergeHintedPrintingLookup(hint, entry.xml, hit), entry.pin)] as const] : [];
      });
    }));
    const results = new Map(batches.flat());
    for (const hint of wanted) {
      const entry = local.get(printingKey(hint))!;
      if (entry.pin && !entry.pin.printing && !results.has(printingKey(hint))) {
        results.set(printingKey(hint), entry.lookup);
      }
    }
    return completePins(results, abort);
  };
  for (const [key, lookup] of await fetchHints(missing, signal)) {
    lookups.set(key, lookup);
  }
  throwIfAborted(signal);
  for (const hint of stale) {
    hydrationOnlyResults.add(lookups.get(printingKey(hint))!);
  }
  if (preferences === await readCardDataPreferences()) {
    rememberHydration(lookups, hints);
  }
  const refreshed = fetchHints(stale).then(async (results) => {
    if (!signal?.aborted && preferences === await readCardDataPreferences()) {
      rememberHydration(results, hints);
    }
    return results;
  }).catch(() => new Map<string, LookupResult>());
  return { lookups, refreshed };
}
