import { act, renderHook, waitFor } from '@testing-library/react';

import { bulkGetFromDexie } from '../../services/cards/catalog/dexieCardMapper';
import { bulkGetFromScryfallCache } from '../../services/cards/catalog/scryfallCache';
import type { LookupResult } from '@app/services';
import { hydrateDeck, type DeckCardDataRefresh } from './hydrate';
import { useDeckLegality } from './hooks/useDeckLegality';

const { fetchCollection } = vi.hoisted(() => ({ fetchCollection: vi.fn() }));

vi.mock('../../services/cards/catalog/dexieCardMapper', async (original) => ({
  ...await original<typeof import('../../services/cards/catalog/dexieCardMapper')>(), bulkGetFromDexie: vi.fn(),
}));
vi.mock('../../services/cards/catalog/scryfallCache', async (original) => ({
  ...await original<typeof import('../../services/cards/catalog/scryfallCache')>(),
  bulkGetFromScryfallCache: vi.fn(), bulkPutScryfallCache: vi.fn(),
}));
vi.mock('../../services/scryfall/client', async (original) => ({
  ...await original<typeof import('../../services/scryfall/client')>(), fetchCollection,
}));
vi.mock('../../services/cards/formatRules', () => ({ getFormatRules: vi.fn().mockResolvedValue(undefined) }));

it('shares stale hydration and refreshed legalities through the session memo without a second Dexie read', async () => {
  const hint = { name: 'Hydrated Opt', set: 'xln', collectorNumber: '65', scryfallId: 'saved' };
  const stale: LookupResult = { ...hint, found: true, source: 'scryfall', fetchedAt: 0,
    printings: [{ ...hint, imageUri: 'https://old/image' }], legalities: { modern: 'legal' },
  };
  vi.mocked(bulkGetFromDexie).mockResolvedValue([undefined]);
  vi.mocked(bulkGetFromScryfallCache).mockResolvedValue([stale]);
  let resolve!: (value: Map<string, unknown>) => void;
  vi.mocked(fetchCollection).mockReturnValue(new Promise((done) => {
    resolve = done;
  }));
  const fresh = new Map([[hint.name, {
    name: hint.name, id: 'saved', set: 'xln', collector_number: '65', legalities: { modern: 'banned' },
  }]]);
  let refreshed: Promise<DeckCardDataRefresh> | undefined;
  const deck = await hydrateDeck({ name: 'Deck', format: 'modern', meta: { v: 1, updatedAt: '' },
    cards: [{ ...hint, quantity: 1, category: 'main' }],
  }, undefined, (refresh) => {
    refreshed = refresh;
  });
  const { result } = renderHook(() => useDeckLegality(deck));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.status).toBe('legal');
  await act(async () => {
    resolve(fresh); await refreshed;
  });
  await waitFor(() => expect(result.current.status).toBe('illegal'));
  expect(bulkGetFromDexie).toHaveBeenCalledTimes(1);
  expect(bulkGetFromScryfallCache).toHaveBeenCalledTimes(1);
  expect(fetchCollection).toHaveBeenCalledExactlyOnceWith([hint], undefined);
});

it('resolves separate saved printings of the same name without a second Dexie read', async () => {
  vi.mocked(bulkGetFromDexie).mockResolvedValue([undefined]);
  vi.mocked(bulkGetFromScryfallCache).mockResolvedValue([undefined]);
  fetchCollection.mockImplementation(async (hints: { name: string; scryfallId: string; set: string; collectorNumber: string }[]) =>
    new Map(hints.map((hint) => [hint.name, { name: hint.name, id: hint.scryfallId,
      set: hint.set, collector_number: hint.collectorNumber, image_uris: { normal: `https://image/${hint.scryfallId}` },
    }])));
  const first = { name: 'Opt', quantity: 1, category: 'main' as const, set: 'XLN', collectorNumber: '65', scryfallId: 'xln' };
  const second = { ...first, quantity: 2, set: 'DOM', collectorNumber: '60', scryfallId: 'dom' };
  const deck = await hydrateDeck({ name: 'Deck', format: 'modern', meta: { v: 1, updatedAt: '' }, cards: [first, second] },
    undefined, () => {});
  expect(deck.cards).toMatchObject([
    { quantity: 1, scryfallId: 'xln', imageUri: 'https://image/xln' },
    { quantity: 2, scryfallId: 'dom', imageUri: 'https://image/dom' },
  ]);
  expect(bulkGetFromDexie).toHaveBeenCalledExactlyOnceWith(['Opt']);
  expect(fetchCollection).toHaveBeenCalledTimes(2);
});

it('uses local hydration data even when the caller does not consume background refreshes', async () => {
  const hint = { name: 'Unobserved Opt', scryfallId: 'saved' };
  vi.mocked(bulkGetFromDexie).mockResolvedValue([undefined]);
  vi.mocked(bulkGetFromScryfallCache).mockResolvedValue([{ name: hint.name, found: true, source: 'scryfall', fetchedAt: 0,
    printings: [{ scryfallId: 'saved', imageUri: 'https://old/image' }],
  }]);
  fetchCollection.mockResolvedValue(new Map([[hint.name, { name: hint.name, id: 'saved', image_uris: { normal: 'https://new/image' } }]]));
  const deck = await hydrateDeck({ name: 'Deck', format: 'modern', meta: { v: 1, updatedAt: '' },
    cards: [{ ...hint, quantity: 1, category: 'main' }],
  });
  expect(deck.cards[0].imageUri).toBe('https://old/image');
});
