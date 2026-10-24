import { vi } from 'vitest';

import {
  getRecentDecks,
  parseRecentDecks,
  recentDeckArtUrl,
  recentDeckScope,
  recentDeckSnapshot,
  recentDecksIn,
  recordRecentDeck,
  RECENT_DECKS_STORAGE_KEY,
  resetRecentDecksCache,
  subscribeRecentDecks,
  withRecentDeck,
  type RecentDeck,
  type RecentDeckSource,
} from './recentDecks';

const SCRYFALL_ID = '0b9a7a0b-8f8e-4b0f-9a8c-1f1e1d1c1b1a';
const HOST = 'ws://localhost:4748';

const source = (overrides: Partial<RecentDeckSource> = {}): RecentDeckSource => ({
  name: 'Atraxa',
  format: 'commander',
  meta: {},
  cards: [
    {
      name: 'Atraxa, Praetors\' Voice',
      quantity: 1,
      category: 'main',
      colors: ['G', 'W', 'U', 'B'],
      isCommander: true,
      scryfallId: SCRYFALL_ID,
    },
    { name: 'Sol Ring', quantity: 1, category: 'main' },
    { name: 'Lightning Bolt', quantity: 3, category: 'sideboard', colors: ['R'] },
  ],
  ...overrides,
});

const entry = (deckId: number, overrides: Partial<RecentDeck> = {}): RecentDeck => ({
  ...recentDeckSnapshot(HOST, 'alice', deckId, source({ name: `Deck ${deckId}` }), deckId),
  ...overrides,
});

describe('recentDeckScope', () => {
  it('lowercases the scheme and host, drops the default port and keeps the path as typed', () => {
    expect(recentDeckScope('WS://LocalHost:4748')).toBe('ws://localhost:4748');
    expect(recentDeckScope('wss://server.cockatrice.us:4748/servatrice/')).toBe('wss://server.cockatrice.us:4748/servatrice');
    expect(recentDeckScope('wss://mtg.example.net:443/')).toBe('wss://mtg.example.net');
    expect(recentDeckScope('ws://mtg.example.net:80')).toBe('ws://mtg.example.net');
  });

  it('keeps servers whose paths differ only in case apart', () => {
    expect(recentDeckScope('wss://h/Alpha')).toBe('wss://h/Alpha');
    expect(recentDeckScope('wss://h/Alpha')).not.toBe(recentDeckScope('wss://h/alpha'));
    expect(recentDeckScope('WSS://H:443/Alpha')).toBe(recentDeckScope('wss://h/Alpha'));
  });

  it('has no scope without a websocket connection', () => {
    expect(recentDeckScope(null)).toBeNull();
    expect(recentDeckScope('https://example.net')).toBeNull();
    expect(recentDeckScope('not a url')).toBeNull();
  });
});

describe('recentDeckSnapshot', () => {
  it('counts the main deck and orders its colours WUBRG', () => {
    const snap = recentDeckSnapshot(HOST, 'alice', 4, source(), 10);
    expect(snap).toMatchObject({ scope: HOST, owner: 'alice', deckId: 4, name: 'Atraxa', colors: 'WUBG', cardCount: 2, openedAt: 10 });
    expect(snap.commanderName).toBe('Atraxa, Praetors\' Voice');
  });

  it('prefers the bracket assessment over the cached level', () => {
    const assessed = source({ meta: { bracketLevel: 2 }, bracketAssessment: { level: 4 } });
    expect(recentDeckSnapshot(HOST, 'a', 1, assessed, 0).bracketLevel).toBe(4);
    expect(recentDeckSnapshot(HOST, 'a', 1, source({ meta: { bracketLevel: 2 } }), 0).bracketLevel).toBe(2);
  });
});

describe('recentDeckArtUrl', () => {
  it('uses the banner card, then the commander', () => {
    expect(recentDeckArtUrl(recentDeckSnapshot(HOST, 'a', 1, source({ bannerCard: 'Sol Ring' }), 0))).toContain('Sol');
    expect(recentDeckArtUrl(recentDeckSnapshot(HOST, 'a', 1, source(), 0))).toContain(SCRYFALL_ID);
    expect(recentDeckArtUrl(recentDeckSnapshot(HOST, 'a', 1, source({ cards: [] }), 0))).toBeNull();
  });
});

describe('withRecentDeck', () => {
  it('moves a reopened deck to the front without duplicating it', () => {
    const list = [entry(1), entry(2), entry(3)];
    expect(withRecentDeck(list, entry(2, { openedAt: 99 })).map((d) => d.deckId)).toEqual([2, 1, 3]);
  });

  it('keeps the same deck id on another server or account apart', () => {
    const list = [entry(1, { owner: 'bob' }), entry(1, { scope: 'ws://other.net:4748' })];
    expect(withRecentDeck(list, entry(1))).toHaveLength(3);
  });

  it('caps each server and account separately', () => {
    const otherHost = [entry(7, { scope: 'ws://other.net:4748' }), entry(8, { scope: 'ws://other.net:4748' })];
    const next = withRecentDeck([entry(1), entry(2), ...otherHost], entry(3), 2);
    expect(recentDecksIn(next, HOST, 'alice').map((d) => d.deckId)).toEqual([3, 1]);
    expect(recentDecksIn(next, 'ws://other.net:4748', 'alice').map((d) => d.deckId)).toEqual([7, 8]);
  });
});

describe('parseRecentDecks', () => {
  it('drops malformed storage and legacy entries without a server', () => {
    const { scope: _scope, ...legacy } = entry(2);
    expect(parseRecentDecks('nope')).toEqual([]);
    expect(parseRecentDecks('{"a":1}')).toEqual([]);
    expect(parseRecentDecks(JSON.stringify([entry(1), legacy, { deckId: 'x' }]))).toEqual([entry(1)]);
  });
});

describe('recordRecentDeck', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetRecentDecksCache();
  });

  it('persists, notifies and skips writes that change nothing', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecentDecks(listener);
    recordRecentDeck(entry(1));
    recordRecentDeck(entry(1, { openedAt: 500 }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(parseRecentDecks(window.localStorage.getItem(RECENT_DECKS_STORAGE_KEY))).toEqual([entry(1)]);
    unsubscribe();
  });

  it('merges with what another tab wrote instead of overwriting it', () => {
    recordRecentDeck(entry(1));
    expect(getRecentDecks()).toHaveLength(1);
    window.localStorage.setItem(RECENT_DECKS_STORAGE_KEY, JSON.stringify([entry(2), entry(1)]));
    recordRecentDeck(entry(3));
    expect(getRecentDecks().map((d) => d.deckId)).toEqual([3, 2, 1]);
  });

  it('purges legacy entries on the next write', () => {
    const { scope: _scope, ...legacy } = entry(9);
    window.localStorage.setItem(RECENT_DECKS_STORAGE_KEY, JSON.stringify([legacy]));
    recordRecentDeck(entry(1));
    expect(JSON.parse(window.localStorage.getItem(RECENT_DECKS_STORAGE_KEY) ?? '[]')).toEqual([entry(1)]);
  });

  it('tells subscribers when another tab changes the list', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecentDecks(listener);
    window.localStorage.setItem(RECENT_DECKS_STORAGE_KEY, JSON.stringify([entry(4)]));
    window.dispatchEvent(new StorageEvent('storage', { key: RECENT_DECKS_STORAGE_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'something.else' }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getRecentDecks().map((d) => d.deckId)).toEqual([4]);
    unsubscribe();
  });

  it('keeps a stable snapshot while storage is unchanged', () => {
    recordRecentDeck(entry(1));
    expect(getRecentDecks()).toBe(getRecentDecks());
  });

  it('keeps decks recorded after a failed write visible this session, beside what storage still holds', () => {
    window.localStorage.setItem(RECENT_DECKS_STORAGE_KEY, JSON.stringify([entry(1)]));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    recordRecentDeck(entry(2));
    recordRecentDeck(entry(3));
    expect(getRecentDecks().map((d) => d.deckId)).toEqual([3, 2, 1]);
    setItem.mockRestore();

    recordRecentDeck(entry(4));
    expect(parseRecentDecks(window.localStorage.getItem(RECENT_DECKS_STORAGE_KEY)).map((d) => d.deckId)).toEqual([4, 3, 2, 1]);
  });
});

describe('recordRecentDeck across tabs', () => {
  const realLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');

  function sharedLocks() {
    let tail: Promise<unknown> = Promise.resolve();
    return {
      request: vi.fn((_name: string, callback: () => unknown) => {
        const run = tail.then(() => callback());
        tail = run.catch(() => undefined);
        return run;
      }),
    };
  }

  function useLocks(locks: unknown) {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
  }

  beforeEach(() => {
    window.localStorage.clear();
    resetRecentDecksCache();
  });

  afterEach(() => {
    if (realLocks) {
      Object.defineProperty(navigator, 'locks', realLocks);
    } else {
      Reflect.deleteProperty(navigator, 'locks');
    }
  });

  it('waits for another tab that is mid-update and keeps both decks', async () => {
    const locks = sharedLocks();
    useLocks(locks);
    let started: () => void = () => {};
    let finish: () => void = () => {};
    const otherTabRead = new Promise<void>((resolve) => {
      started = resolve;
    });
    const otherTab = locks.request(RECENT_DECKS_STORAGE_KEY, async () => {
      const snapshot = parseRecentDecks(window.localStorage.getItem(RECENT_DECKS_STORAGE_KEY));
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      window.localStorage.setItem(RECENT_DECKS_STORAGE_KEY, JSON.stringify(withRecentDeck(snapshot, entry(2))));
    });
    await otherTabRead;

    const mine = recordRecentDeck(entry(1));
    finish();
    await Promise.all([otherTab, mine]);

    expect(locks.request).toHaveBeenLastCalledWith(RECENT_DECKS_STORAGE_KEY, expect.any(Function));
    expect(getRecentDecks().map((d) => d.deckId)).toEqual([1, 2]);
  });

  it('applies overlapping updates from this tab in order', async () => {
    useLocks(sharedLocks());
    await Promise.all([recordRecentDeck(entry(1)), recordRecentDeck(entry(2)), recordRecentDeck(entry(3))]);
    expect(getRecentDecks().map((d) => d.deckId)).toEqual([3, 2, 1]);
  });

  it('still records when the lock cannot be taken', async () => {
    useLocks({ request: vi.fn(() => Promise.reject(new DOMException('denied', 'SecurityError'))) });
    await recordRecentDeck(entry(1));
    expect(getRecentDecks().map((d) => d.deckId)).toEqual([1]);
  });
});
