import { dexieService } from '../../dexie';
import type { LookupResult, PrintingSummary } from './types';

export const SCRYFALL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ScryfallCacheHint {
  set?: string;
  collectorNumber?: string;
  scryfallId?: string;
}

type ScryfallCacheRecord = LookupResult & { fetchedAt?: number };

export function isScryfallCacheFresh(
  result: ScryfallCacheRecord,
  now = Date.now(),
): boolean {
  return typeof result.fetchedAt === 'number'
    && Number.isFinite(result.fetchedAt)
    && now - result.fetchedAt >= 0
    && now - result.fetchedAt < SCRYFALL_CACHE_TTL_MS;
}

export async function getFromScryfallCache(
  name: string,
  hint?: ScryfallCacheHint,
): Promise<LookupResult | undefined> {
  try {
    const raw = (await dexieService.scryfallCache.get(name)) as
      | ScryfallCacheRecord
      | undefined;
    return readCached(raw, hint);
  } catch {
    return undefined;
  }
}

export async function bulkGetFromScryfallCache(
  names: string[],
  hints?: ReadonlyArray<ScryfallCacheHint | undefined>,
): Promise<Array<LookupResult | undefined>> {
  try {
    const raw = (await dexieService.scryfallCache.bulkGet(names)) as Array<
      ScryfallCacheRecord | undefined
    >;
    return raw.map((result, index) => readCached(result, hints?.[index]));
  } catch {
    return names.map(() => undefined);
  }
}

function readCached(
  result: ScryfallCacheRecord | undefined,
  hint?: ScryfallCacheHint,
): LookupResult | undefined {
  if (!result || !matchesHint(result.printings, hint)) {
    return undefined;
  }
  return sanitizeCached(result);
}

export function matchesHint(
  printings: PrintingSummary[],
  hint?: ScryfallCacheHint,
): boolean {
  if (!hint) {
    return true;
  }
  if (hint.scryfallId) {
    return printings.some((printing) => printing.scryfallId === hint.scryfallId);
  }
  if (!hint.set && !hint.collectorNumber) {
    return true;
  }
  return printings.some((printing) =>
    (!hint.set || printing.set?.toLowerCase() === hint.set.toLowerCase())
    && (!hint.collectorNumber || printing.collectorNumber === hint.collectorNumber));
}

function sanitizeCached(result: ScryfallCacheRecord): LookupResult {
  if (!result.related) {
    return result;
  }
  const filtered = result.related.filter((related) => related.component !== 'combo_piece');
  if (filtered.length === result.related.length) {
    return result;
  }
  return { ...result, related: filtered.length > 0 ? filtered : undefined };
}

export async function putScryfallCache(result: LookupResult): Promise<void> {
  try {
    const previous = await getFromScryfallCache(result.name);
    await dexieService.scryfallCache.put(toCacheRecord(retainPrintings(result, previous), Date.now()));
  } catch {
    return;
  }
}

export async function bulkPutScryfallCache(results: LookupResult[]): Promise<void> {
  if (results.length === 0) {
    return;
  }
  try {
    const fetchedAt = Date.now();
    const previous = await bulkGetFromScryfallCache(results.map((result) => result.name));
    await dexieService.scryfallCache.bulkPut(results.map((result, index) =>
      toCacheRecord(retainPrintings(result, previous[index]), fetchedAt)));
  } catch {
    return;
  }
}

function retainPrintings(result: LookupResult, previous?: LookupResult): LookupResult {
  if (!previous || previous.name !== result.name) {
    return result;
  }
  const ids = new Set(result.printings.map((printing) => printing.scryfallId));
  const retained = previous.printings.filter((printing) => printing.scryfallId && !ids.has(printing.scryfallId));
  return retained.length ? { ...result, printings: [...result.printings, ...retained] } : result;
}

function toCacheRecord(result: LookupResult, fallbackFetchedAt: number): ScryfallCacheRecord {
  const fetchedAt = (result as ScryfallCacheRecord).fetchedAt;
  return {
    ...result,
    fetchedAt: typeof fetchedAt === 'number' && Number.isFinite(fetchedAt)
      ? fetchedAt
      : fallbackFetchedAt,
  };
}
