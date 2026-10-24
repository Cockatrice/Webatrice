import { rethrowCancellationOrRateLimit, scheduleScryfallRequest, throwIfAborted } from './scheduler';
import { createSharedRequestPool } from './sharedRequests';
import type { ScryfallCard, ScryfallCardHint, ScryfallIdentifier } from './types';

export const SCRYFALL_API = 'https://api.scryfall.com';
export const SCRYFALL_COLLECTION_URL = `${SCRYFALL_API}/cards/collection`;
export const SCRYFALL_COLLECTION_LIMIT = 75;
export const SCRYFALL_NAMED_RETRY_CAP = 50;

const TOKEN_SUFFIX_RE = /\s*\(?\bToken\b\)?\s*$/i;
const shareCard = createSharedRequestPool<ScryfallCard | null>();
const sharePrintings = createSharedRequestPool<ScryfallCard[]>();

export function cleanScryfallName(name: string): string {
  return name.replace(TOKEN_SUFFIX_RE, '');
}

function normalizedName(name: string): string {
  return cleanScryfallName(name).normalize('NFC').trim();
}

function cardKey(hint: ScryfallCardHint): string {
  if (hint.scryfallId) {
    return JSON.stringify(['id', hint.scryfallId]);
  }
  return JSON.stringify([normalizedName(hint.name).toLowerCase(), hint.set?.toLowerCase() ?? '', hint.collectorNumber ?? '']);
}

export function chunkForCollection<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += SCRYFALL_COLLECTION_LIMIT) {
    chunks.push(items.slice(i, i + SCRYFALL_COLLECTION_LIMIT));
  }
  return chunks;
}

export function scryfallCardUrl(scryfallId: string): string {
  return `${SCRYFALL_API}/cards/${encodeURIComponent(scryfallId)}`;
}

export function scryfallNamedUrl(exactName: string): string {
  return `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(exactName)}`;
}

export function scryfallSearchUrl(q: string, params: string): string {
  return `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(q)}&${params}`;
}

export function postCollection(identifiers: readonly ScryfallIdentifier[], signal?: AbortSignal): Promise<Response> {
  return scheduleScryfallRequest(SCRYFALL_COLLECTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers }),
    ...(signal ? { signal } : {}),
  });
}

async function fetchCard(url: string, signal: AbortSignal): Promise<ScryfallCard | null> {
  try {
    const response = await scheduleScryfallRequest(url, { signal });
    return response.ok ? await response.json() as ScryfallCard : null;
  } catch (error) {
    rethrowCancellationOrRateLimit(error);
    return null;
  }
}

export function fetchNamedCard(name: string, signal?: AbortSignal): Promise<ScryfallCard | null> {
  return shareCard(cardKey({ name }), (sharedSignal) => fetchCard(scryfallNamedUrl(normalizedName(name)), sharedSignal), signal);
}

export function fetchCardById(id: string, signal?: AbortSignal): Promise<ScryfallCard | null> {
  return shareCard(cardKey({ name: '', scryfallId: id }), (sharedSignal) => fetchCard(scryfallCardUrl(id), sharedSignal), signal);
}

interface PendingCard {
  hint: ScryfallCardHint;
  signal: AbortSignal;
  resolve: (card: ScryfallCard | null) => void;
  reject: (error: unknown) => void;
}

function identifier(hint: ScryfallCardHint): ScryfallIdentifier {
  if (hint.scryfallId) {
    return { id: hint.scryfallId };
  }
  if (hint.set && hint.collectorNumber) {
    return { set: hint.set.toLowerCase(), collector_number: hint.collectorNumber };
  }
  return { name: normalizedName(hint.name), ...(hint.set ? { set: hint.set.toLowerCase() } : {}) };
}

async function fetchChunk(chunk: PendingCard[]): Promise<void> {
  const controller = new AbortController();
  const abortIfUnused = () => {
    if (chunk.every((item) => item.signal.aborted)) {
      controller.abort();
    }
  };
  for (const item of chunk) {
    item.signal.addEventListener('abort', abortIfUnused);
  }
  abortIfUnused();
  try {
    const response = await postCollection(chunk.map(({ hint }) => identifier(hint)), controller.signal);
    if (!response.ok) {
      console.warn(`Scryfall /cards/collection returned ${response.status} for ${chunk.length} identifiers`);
    }
    const body = response.ok ? await response.json() as { data?: ScryfallCard[] } : {};
    for (const { hint, resolve } of chunk) {
      const cards = body.data ?? [];
      const matchesName = (card: ScryfallCard) => {
        const name = card.name.normalize('NFC').toLowerCase();
        const requested = normalizedName(hint.name).toLowerCase();
        return name === requested || name.split(' // ')[0] === requested;
      };
      const exact = hint.scryfallId ? cards.find((card) => card.id === hint.scryfallId)
        : hint.set ? cards.find((card) => card.set?.toLowerCase() === hint.set!.toLowerCase()
          && (!hint.collectorNumber || card.collector_number === hint.collectorNumber)
          && matchesName(card)) : undefined;
      const byName = hint.scryfallId || hint.set ? undefined : cards.find(matchesName);
      resolve(exact ?? byName ?? null);
    }
  } catch (error) {
    for (const item of chunk) {
      try {
        rethrowCancellationOrRateLimit(error);
        item.resolve(null);
      } catch {
        item.reject(error);
      }
    }
  } finally {
    for (const item of chunk) {
      item.signal.removeEventListener('abort', abortIfUnused);
    }
  }
}

export async function fetchCollection(hints: readonly ScryfallCardHint[], signal?: AbortSignal): Promise<Map<string, ScryfallCard>> {
  throwIfAborted(signal);
  const pending: PendingCard[] = [];
  const results = hints.map((hint) => shareCard(cardKey(hint), (sharedSignal) => new Promise((resolve, reject) => {
    pending.push({ hint, signal: sharedSignal, resolve, reject });
  }), signal));
  for (const chunk of chunkForCollection(pending)) {
    void fetchChunk(chunk);
  }
  const cards = await Promise.all(results);
  return new Map(cards.flatMap((card, i) => card ? [[hints[i].name, card] as const] : []));
}

export function fetchPrintings(name: string, signal?: AbortSignal): Promise<ScryfallCard[]> {
  const q = `!"${normalizedName(name).replace(/"/g, '\\"')}"`;
  const url = scryfallSearchUrl(q, 'unique=prints&order=released&dir=desc');
  return sharePrintings(normalizedName(name).toLowerCase(), async (sharedSignal) => {
    try {
      const response = await scheduleScryfallRequest(url, { signal: sharedSignal });
      if (!response.ok) {
        return [];
      }
      const body = await response.json() as { data?: ScryfallCard[] };
      return body.data ?? [];
    } catch (error) {
      rethrowCancellationOrRateLimit(error);
      return [];
    }
  }, signal);
}
