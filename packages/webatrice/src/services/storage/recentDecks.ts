import { ScryfallImageSize } from '@cockatrice/datatrice';

import { getScryfallUrlByExactName, getScryfallUrlById } from '../scryfall';
import { readLocalStorage, writeLocalStorage } from './localStorage';

export interface RecentDeck {
  scope: string;
  owner: string;
  deckId: number;
  name: string;
  format: string;
  colors: string;
  cardCount: number;
  bracketLevel?: number;
  bannerCard?: string;
  bannerCardProviderId?: string;
  commanderName?: string;
  commanderScryfallId?: string;
  openedAt: number;
}

export interface RecentDeckSource {
  name: string;
  format: string;
  bannerCard?: string;
  bannerCardProviderId?: string;
  cards: ReadonlyArray<{
    name: string;
    quantity: number;
    category: string;
    colors?: string[];
    isCommander?: boolean;
    scryfallId?: string;
  }>;
  meta: { bracketLevel?: number };
  bracketAssessment?: { level: number };
}

export const RECENT_DECKS_STORAGE_KEY = 'webatrice.recentDecks';
export const RECENT_DECKS_LIMIT = 24;

const WUBRG = ['W', 'U', 'B', 'R', 'G'];
const SCRYFALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function recentDeckScope(endpoint: string | null | undefined): string | null {
  if (!endpoint) {
    return null;
  }
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return null;
    }
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return null;
  }
}

export function recentDeckSnapshot(
  scope: string,
  owner: string,
  deckId: number,
  deck: RecentDeckSource,
  openedAt: number,
): RecentDeck {
  const colors = new Set<string>();
  let cardCount = 0;
  for (const card of deck.cards) {
    if (card.category !== 'main') {
      continue;
    }
    cardCount += card.quantity;
    for (const color of card.colors ?? []) {
      colors.add(color.toUpperCase());
    }
  }
  const commander = deck.cards.find((card) => card.isCommander);
  const entry: RecentDeck = {
    scope,
    owner,
    deckId,
    name: deck.name,
    format: deck.format,
    colors: WUBRG.filter((c) => colors.has(c)).join(''),
    cardCount,
    openedAt,
  };
  const bracketLevel = deck.bracketAssessment?.level ?? deck.meta.bracketLevel;
  if (bracketLevel != null) {
    entry.bracketLevel = bracketLevel;
  }
  if (deck.bannerCard?.trim()) {
    entry.bannerCard = deck.bannerCard.trim();
    if (deck.bannerCardProviderId) {
      entry.bannerCardProviderId = deck.bannerCardProviderId;
    }
  }
  if (commander) {
    entry.commanderName = commander.name;
    if (commander.scryfallId) {
      entry.commanderScryfallId = commander.scryfallId;
    }
  }
  return entry;
}

export function recentDeckArtUrl(deck: RecentDeck): string | null {
  if (deck.bannerCard) {
    return deck.bannerCardProviderId && SCRYFALL_ID.test(deck.bannerCardProviderId)
      ? getScryfallUrlById(deck.bannerCardProviderId, ScryfallImageSize.ArtCrop)
      : getScryfallUrlByExactName(deck.bannerCard, ScryfallImageSize.ArtCrop);
  }
  if (deck.commanderScryfallId && SCRYFALL_ID.test(deck.commanderScryfallId)) {
    return getScryfallUrlById(deck.commanderScryfallId, ScryfallImageSize.ArtCrop);
  }
  if (deck.commanderName?.trim()) {
    return getScryfallUrlByExactName(deck.commanderName.trim(), ScryfallImageSize.ArtCrop);
  }
  return null;
}

function isRecentDeck(value: unknown): value is RecentDeck {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Partial<RecentDeck>;
  return typeof v.scope === 'string' && v.scope.length > 0
    && typeof v.owner === 'string'
    && typeof v.deckId === 'number'
    && typeof v.name === 'string'
    && typeof v.format === 'string'
    && typeof v.colors === 'string'
    && typeof v.cardCount === 'number'
    && typeof v.openedAt === 'number';
}

export function parseRecentDecks(raw: string | null): RecentDeck[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentDeck) : [];
  } catch {
    return [];
  }
}

function sameScope(a: RecentDeck, b: Pick<RecentDeck, 'scope' | 'owner'>): boolean {
  return a.scope === b.scope && a.owner === b.owner;
}

function sameDeck(a: RecentDeck, b: RecentDeck): boolean {
  return sameScope(a, b) && a.deckId === b.deckId;
}

function sameContent(a: RecentDeck, b: RecentDeck): boolean {
  const { openedAt: _a, ...restA } = a;
  const { openedAt: _b, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}

export function recentDecksIn(list: readonly RecentDeck[], scope: string, owner: string): RecentDeck[] {
  return list.filter((deck) => sameScope(deck, { scope, owner }));
}

export function withRecentDeck(list: readonly RecentDeck[], entry: RecentDeck, limit = RECENT_DECKS_LIMIT): RecentDeck[] {
  const others = list.filter((deck) => !sameScope(deck, entry));
  const mine = [entry, ...recentDecksIn(list, entry.scope, entry.owner).filter((deck) => !sameDeck(deck, entry))];
  return [...mine.slice(0, limit), ...others];
}

function deckKey(deck: RecentDeck): string {
  return JSON.stringify([deck.scope, deck.owner, deck.deckId]);
}

function mergeRecentDecks(
  stored: readonly RecentDeck[],
  pending: readonly RecentDeck[],
  limit = RECENT_DECKS_LIMIT,
): RecentDeck[] {
  const newest = new Map<string, RecentDeck>();
  for (const deck of [...pending, ...stored]) {
    const seen = newest.get(deckKey(deck));
    if (!seen || deck.openedAt > seen.openedAt) {
      newest.set(deckKey(deck), deck);
    }
  }
  const perScope = new Map<string, number>();
  return [...newest.values()]
    .sort((a, b) => b.openedAt - a.openedAt)
    .filter((deck) => {
      const scope = JSON.stringify([deck.scope, deck.owner]);
      const count = (perScope.get(scope) ?? 0) + 1;
      perScope.set(scope, count);
      return count <= limit;
    });
}

const LOCK_NAME = RECENT_DECKS_STORAGE_KEY;
const EMPTY: RecentDeck[] = [];
const listeners = new Set<() => void>();
let unsaved: RecentDeck[] | null = null;
let lastStored: string | null = null;
let lastUnsaved: RecentDeck[] | null = null;
let lastParsed: RecentDeck[] = EMPTY;

function currentRecentDecks(stored: string | null): RecentDeck[] {
  const saved = stored ? parseRecentDecks(stored) : EMPTY;
  return unsaved ? mergeRecentDecks(saved, unsaved) : saved;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === RECENT_DECKS_STORAGE_KEY) {
    notify();
  }
}

export function getRecentDecks(): RecentDeck[] {
  const stored = readLocalStorage(RECENT_DECKS_STORAGE_KEY);
  if (stored !== lastStored || unsaved !== lastUnsaved) {
    lastStored = stored;
    lastUnsaved = unsaved;
    lastParsed = currentRecentDecks(stored);
  }
  return lastParsed;
}

export function subscribeRecentDecks(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function writeRecentDeck(entry: RecentDeck): void {
  const current = currentRecentDecks(readLocalStorage(RECENT_DECKS_STORAGE_KEY));
  const first = recentDecksIn(current, entry.scope, entry.owner)[0];
  if (first && sameDeck(first, entry) && sameContent(first, entry)) {
    return;
  }
  const next = withRecentDeck(current, entry);
  const raw = JSON.stringify(next);
  writeLocalStorage(RECENT_DECKS_STORAGE_KEY, raw);
  unsaved = readLocalStorage(RECENT_DECKS_STORAGE_KEY) === raw ? null : next;
  notify();
}

function lockManager(): LockManager | null {
  return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function' ? navigator.locks : null;
}

export function recordRecentDeck(entry: RecentDeck): Promise<void> {
  const locks = lockManager();
  if (!locks) {
    writeRecentDeck(entry);
    return Promise.resolve();
  }
  let written = false;
  const write = () => {
    written = true;
    writeRecentDeck(entry);
  };
  return locks.request(LOCK_NAME, write).then(
    () => undefined,
    () => {
      if (!written) {
        writeRecentDeck(entry);
      }
    },
  );
}

export function resetRecentDecksCache(): void {
  unsaved = null;
  lastStored = null;
  lastUnsaved = null;
  lastParsed = EMPTY;
}
