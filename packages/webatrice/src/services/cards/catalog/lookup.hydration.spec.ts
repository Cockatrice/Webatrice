import { waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';

import { dexieService } from '../../dexie';
import { fetchCollection } from '../../scryfall/client';
import type { ScryfallCard } from '../../scryfall/types';
import { cardLookupRevision, lookupCards, lookupCardsCached, lookupCardsForHydration, printingKey, subscribeCardLookups } from './lookup';
import { scryfallToLookup } from './scryfallCardMapper';
import type { LookupResult } from './types';

vi.mock('../../dexie', () => ({ dexieService: {
  cards: { get: vi.fn(), bulkGet: vi.fn() },
  scryfallCache: { get: vi.fn(), bulkGet: vi.fn(), put: vi.fn(), bulkPut: vi.fn() },
} }));
vi.mock('../../scryfall/client', () => ({
  scryfallCardUrl: (id: string) => `https://api.scryfall.com/cards/${id}`,
  fetchCollection: vi.fn(), fetchNamedCard: vi.fn(), fetchPrintings: vi.fn(), SCRYFALL_NAMED_RETRY_CAP: 50,
}));
vi.mock('../formatRules', () => ({ getFormatRules: vi.fn().mockResolvedValue(undefined) }));

const cards = dexieService.cards as unknown as { bulkGet: Mock };
const cache = dexieService.scryfallCache as unknown as { bulkGet: Mock };
const hint = { name: 'Opt', set: 'xln', collectorNumber: '65', scryfallId: 'saved' };
const stale: LookupResult = {
  name: 'Opt', found: true, source: 'scryfall', fetchedAt: 0, typeLine: 'Sorcery',
  printings: [{ ...hint, imageUri: 'https://old/image' }], legalities: { modern: 'legal' },
};
const fresh: ScryfallCard = {
  name: 'Opt', id: 'saved', set: 'xln', collector_number: '65', type_line: 'Instant',
  image_uris: { normal: 'https://new/image' }, legalities: { modern: 'banned' },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  cards.bulkGet.mockImplementation(async (names: string[]) => names.map(() => undefined));
  cache.bulkGet.mockImplementation(async (names: string[]) => names.map(() => undefined));
});

it('returns stale data immediately, refreshes once with printing hints and writes the cache after cancellation', async () => {
  cache.bulkGet.mockResolvedValue([stale]);
  const pending = deferred<Map<string, ScryfallCard>>();
  vi.mocked(fetchCollection).mockReturnValue(pending.promise);
  const controller = new AbortController();
  const result = await lookupCardsForHydration([hint], controller.signal);
  expect(result.lookups.get(printingKey(hint))).toMatchObject({ typeLine: 'Sorcery' });
  expect(fetchCollection).toHaveBeenCalledExactlyOnceWith([hint], undefined);
  controller.abort();
  pending.resolve(new Map([['Opt', fresh]]));
  expect((await result.refreshed).get(printingKey(hint))).toMatchObject({ typeLine: 'Instant' });
  expect(dexieService.scryfallCache.bulkPut).toHaveBeenCalledWith([expect.objectContaining({ name: 'Opt', typeLine: 'Instant' })]);
  expect(cards.bulkGet).toHaveBeenCalledTimes(1);
});

it('returns a Dexie-only card immediately and keeps the preferred printing', async () => {
  cards.bulkGet.mockResolvedValue([{ name: { value: 'Opt' }, set: { value: 'fav', uuid: 'preferred' } }]);
  const pending = deferred<Map<string, ScryfallCard>>();
  vi.mocked(fetchCollection).mockReturnValue(pending.promise);
  const result = await lookupCardsForHydration([{ name: 'Opt' }]);
  expect(result.lookups.get(printingKey({ name: 'Opt' }))?.printings[0].scryfallId).toBe('preferred');
  pending.resolve(new Map([['Opt', fresh]]));
  expect((await result.refreshed).get(printingKey({ name: 'Opt' }))?.printings[0].scryfallId).toBe('preferred');
});

it('waits for Scryfall only when no local data exists', async () => {
  const pending = deferred<Map<string, ScryfallCard>>();
  vi.mocked(fetchCollection).mockReturnValue(pending.promise);
  let settled = false;
  const result = lookupCardsForHydration([hint]).then((value) => {
    settled = true; return value;
  });
  await waitFor(() => expect(fetchCollection).toHaveBeenCalledOnce());
  expect(settled).toBe(false);
  pending.resolve(new Map([['Opt', fresh]]));
  expect((await result).lookups.get(printingKey(hint))?.printings[0].scryfallId).toBe('saved');
});

it('uses mismatched cached printing data locally while resolving the saved printing in the background', async () => {
  cache.bulkGet.mockResolvedValue([{ ...stale, printings: [{ scryfallId: 'other' }] }]);
  const pending = deferred<Map<string, ScryfallCard>>();
  vi.mocked(fetchCollection).mockReturnValue(pending.promise);
  const result = await lookupCardsForHydration([hint]);
  expect(result.lookups.get(printingKey(hint))?.found).toBe(true);
  pending.resolve(new Map([['Opt', fresh]]));
  expect((await result.refreshed).get(printingKey(hint))?.printings[0].scryfallId).toBe('saved');
});


it('memoizes the input spelling when Scryfall returns a canonical card name', async () => {
  cache.bulkGet.mockResolvedValue([stale]);
  vi.mocked(fetchCollection).mockResolvedValue(new Map([['opt', fresh]]));
  const result = await lookupCardsForHydration([{ ...hint, name: 'opt' }]);
  await result.refreshed;
  expect((await lookupCardsCached(['opt'], undefined, true)).get('opt')?.name).toBe('Opt');
  expect(cards.bulkGet).toHaveBeenCalledTimes(1);
});

it('keeps ordinary cached callers waiting for Scryfall while Dexie-only hydration refreshes', async () => {
  const name = 'Dexie pending';
  cards.bulkGet.mockResolvedValue([{ name: { value: name } }]);
  const pending = deferred<Map<string, ScryfallCard>>();
  vi.mocked(fetchCollection).mockReturnValueOnce(pending.promise).mockResolvedValue(new Map([[name, { ...fresh, name }]]));
  const result = await lookupCardsForHydration([name]);
  const ordinary = await lookupCardsCached([name]);
  expect(ordinary.get(name)?.source).toBe('dexie+scryfall');
  expect(fetchCollection).toHaveBeenCalledTimes(2);
  pending.resolve(new Map([[name, { ...fresh, name }]]));
  await result.refreshed;
});

it('shares an unresolved hydration result with legality but permits ordinary callers to retry', async () => {
  const name = 'Unknown hydration';
  vi.mocked(fetchCollection).mockRejectedValue(new TypeError('offline'));
  const result = await lookupCardsForHydration([name]);
  await result.refreshed;
  expect((await lookupCardsCached([name], undefined, true)).get(name)?.found).toBe(false);
  expect(cards.bulkGet).toHaveBeenCalledTimes(1);
  await lookupCardsCached([name]);
  expect(cards.bulkGet).toHaveBeenCalledTimes(2);
});

it('does not notify memo subscribers when refresh only changes the timestamp', async () => {
  cache.bulkGet.mockResolvedValue([{ ...scryfallToLookup(fresh), fetchedAt: 0 }]);
  const pending = deferred<Map<string, ScryfallCard>>();
  vi.mocked(fetchCollection).mockReturnValue(pending.promise);
  const result = await lookupCardsForHydration([hint]);
  const revision = cardLookupRevision();
  const listener = vi.fn();
  const unsubscribe = subscribeCardLookups(listener);
  pending.resolve(new Map([['Opt', fresh]]));
  await result.refreshed;
  expect(cardLookupRevision()).toBe(revision);
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
});

it('retains local data and resolves an empty refresh when the background request fails', async () => {
  cache.bulkGet.mockResolvedValue([stale]);
  vi.mocked(fetchCollection).mockRejectedValue(new TypeError('offline'));
  const result = await lookupCardsForHydration([hint]);
  expect(result.lookups.get(printingKey(hint))).toEqual(stale);
  expect(await result.refreshed).toEqual(new Map());
  expect(dexieService.scryfallCache.bulkPut).not.toHaveBeenCalled();
});

it('uses a fresh matching cache entry without requesting a refresh', async () => {
  cache.bulkGet.mockResolvedValue([{ ...stale, fetchedAt: Date.now() }]);
  const result = await lookupCardsForHydration([hint]);
  expect(result.lookups.get(printingKey(hint))?.found).toBe(true);
  expect(await result.refreshed).toEqual(new Map());
  expect(fetchCollection).not.toHaveBeenCalled();
});


it('returns the same local card data for fresh name lookups through both batch entry points', async () => {
  const names = ['Opt', 'Cache only'];
  cards.bulkGet.mockResolvedValue([{ name: { value: 'Opt' },
    set: { value: 'fav', uuid: 'preferred', picurl: 'https://mirror/preferred' },
  }, undefined]);
  cache.bulkGet.mockResolvedValue([
    { ...stale, fetchedAt: Date.now() },
    { ...stale, name: 'Cache only', fetchedAt: Date.now() },
  ]);
  const ordinary = await lookupCards(names);
  const hydration = await lookupCardsForHydration(names);
  expect(names.map((name) => hydration.lookups.get(printingKey({ name })))).toEqual(names.map((name) => ordinary.get(name)));
  expect(ordinary.get('Opt')?.printings).toHaveLength(1);
  expect(ordinary.get('Opt')?.printings[0].scryfallId).toBe('preferred');
  expect(await hydration.refreshed).toEqual(new Map());
  expect(fetchCollection).not.toHaveBeenCalled();
});

it('supplements XML printings with only the requested cached printing in both batch entry points', async () => {
  cards.bulkGet.mockResolvedValue([{ name: { value: 'Opt' },
    set: { value: 'fav', uuid: 'preferred', picurl: 'https://mirror/preferred' },
  }]);
  cache.bulkGet.mockResolvedValue([{ ...stale, fetchedAt: Date.now(), printings: [
    ...stale.printings, { set: 'other', scryfallId: 'unrequested' },
  ] }]);
  const ordinary = (await lookupCards([hint])).get('Opt');
  const hydration = await lookupCardsForHydration([hint]);
  expect(ordinary?.printings.map((printing) => printing.scryfallId)).toEqual(['preferred', 'saved']);
  expect(ordinary?.printings[0].imageUri).toBe('https://mirror/preferred');
  expect(hydration.lookups.get(printingKey(hint))).toEqual(ordinary);
  expect(await hydration.refreshed).toEqual(new Map());
  expect(fetchCollection).not.toHaveBeenCalled();
});

it('does not substitute a mismatched cached printing when an ordinary hinted refresh fails', async () => {
  cache.bulkGet.mockResolvedValue([{ ...stale, fetchedAt: Date.now(), printings: [{ scryfallId: 'other' }] }]);
  vi.mocked(fetchCollection).mockRejectedValue(new TypeError('offline'));
  expect((await lookupCards([hint])).get('Opt')).toMatchObject({ found: false, printings: [] });
  expect(fetchCollection).toHaveBeenCalledExactlyOnceWith([hint], undefined);
});
