import type { Mock } from 'vitest';

import { dexieService } from '../../dexie';
import { fetchCollection, fetchNamedCard } from '../../scryfall/client';
import { ScryfallRateLimitError } from '../../scryfall/scheduler';
import { lookupCard, lookupCards, lookupCardsCached } from './lookup';
import { SCRYFALL_CACHE_TTL_MS } from './scryfallCache';

vi.mock('../../dexie', () => ({ dexieService: {
  cards: { get: vi.fn(), bulkGet: vi.fn() },
  scryfallCache: { get: vi.fn(), bulkGet: vi.fn(), put: vi.fn(), bulkPut: vi.fn() },
} }));
vi.mock('../../scryfall/client', () => ({
  fetchCollection: vi.fn(), fetchNamedCard: vi.fn(), fetchPrintings: vi.fn(), SCRYFALL_NAMED_RETRY_CAP: 50,
}));

const cards = dexieService.cards as unknown as { get: Mock; bulkGet: Mock };
const cache = dexieService.scryfallCache as unknown as { get: Mock; bulkGet: Mock };

beforeEach(() => {
  cards.get.mockResolvedValue(undefined);
  cards.bulkGet.mockImplementation(async (names: string[]) => names.map(() => undefined));
  cache.get.mockResolvedValue(undefined);
  cache.bulkGet.mockImplementation(async (names: string[]) => names.map(() => undefined));
});

afterEach(() => {
  vi.useRealTimers();
});

it.each(['single', 'batch'] as const)('preserves a stale row when a %s refresh fails, then replaces it on success', async (kind) => {
  const name = `Stale ${kind}`;
  const stale = {
    name, found: true, source: 'scryfall', fetchedAt: Date.now() - SCRYFALL_CACHE_TTL_MS,
    printings: [], legalities: { modern: 'legal' },
  };
  cache.get.mockResolvedValue(stale);
  cache.bulkGet.mockResolvedValue([stale]);
  vi.mocked(fetchNamedCard).mockRejectedValue(new ScryfallRateLimitError());
  vi.mocked(fetchCollection).mockRejectedValue(new ScryfallRateLimitError());
  const lookup = async () => kind === 'single' ? lookupCard(name) : (await lookupCards([name])).get(name);
  await expect(lookup()).resolves.toEqual(stale);
  expect(dexieService.scryfallCache.put).not.toHaveBeenCalled();
  expect(dexieService.scryfallCache.bulkPut).not.toHaveBeenCalled();

  const refreshed = { id: 'card', name, legalities: { modern: 'banned' } };
  vi.mocked(fetchNamedCard).mockResolvedValue(refreshed);
  vi.mocked(fetchCollection).mockResolvedValue(new Map([[name, refreshed]]));
  await expect(lookup()).resolves.toMatchObject({ legalities: { modern: 'banned' } });
});

it.each(['single', 'batch'] as const)('preserves Dexie results after a %s network failure', async (kind) => {
  const name = `Offline ${kind}`;
  const xml = { name: { value: name }, prop: { value: { type: { value: 'Creature' } } } };
  cards.get.mockResolvedValue(xml);
  cards.bulkGet.mockResolvedValue([xml]);
  vi.mocked(fetchNamedCard).mockRejectedValue(new TypeError('offline'));
  vi.mocked(fetchCollection).mockRejectedValue(new TypeError('offline'));
  const result = kind === 'single' ? lookupCard(name) : lookupCards([name]).then((hits) => hits.get(name));
  await expect(result).resolves.toMatchObject({ source: 'dexie', name, found: true });
});

it.each(['single', 'batch'] as const)('rethrows a %s network cancellation despite a stale row', async (kind) => {
  const name = `Aborted ${kind}`;
  const stale = { name, found: true, source: 'scryfall', fetchedAt: 0, printings: [] };
  cache.get.mockResolvedValue(stale);
  cache.bulkGet.mockResolvedValue([stale]);
  const error = new DOMException('Aborted', 'AbortError');
  vi.mocked(fetchNamedCard).mockRejectedValue(error);
  vi.mocked(fetchCollection).mockRejectedValue(error);
  const result = kind === 'single' ? lookupCard(name) : lookupCards([name]);
  await expect(result).rejects.toBe(error);
});

it('memoizes Dexie-only cards without applying the Scryfall TTL', async () => {
  const name = 'Custom session token';
  cards.bulkGet.mockResolvedValue([{ name: { value: name }, token: { value: '1' } }]);
  vi.mocked(fetchCollection).mockResolvedValue(new Map());
  vi.mocked(fetchNamedCard).mockResolvedValue(null);
  await expect(lookupCardsCached([name])).resolves.toEqual(new Map([[name, expect.objectContaining({ source: 'dexie' })]]));
  await lookupCardsCached([name]);
  expect(cards.bulkGet).toHaveBeenCalledTimes(1);
  expect(fetchCollection).toHaveBeenCalledTimes(1);
  expect(fetchNamedCard).toHaveBeenCalledTimes(1);
});

it.each([{ set: 'xln' }, { set: 'xln', collectorNumber: '65' }, { scryfallId: 'wanted' }])(
  'does not retry a hinted collection miss by name: %j', async (hint) => {
    vi.mocked(fetchCollection).mockResolvedValue(new Map());
    vi.mocked(fetchNamedCard).mockResolvedValue({ id: 'wrong', name: 'Opt' });
    expect((await lookupCards([{ name: 'Opt', ...hint }])).get('Opt')).toMatchObject({ found: false });
    expect(fetchNamedCard).not.toHaveBeenCalled();
    expect(dexieService.scryfallCache.bulkPut).not.toHaveBeenCalled();
  },
);

it('refetches a fresh cached name if its printing does not match the hint', async () => {
  cache.bulkGet.mockResolvedValue([{
    name: 'Opt', found: true, source: 'scryfall', fetchedAt: Date.now(),
    printings: [{ set: 'dom', collectorNumber: '60' }],
  }]);
  vi.mocked(fetchCollection).mockResolvedValue(new Map([['Opt', { id: 'xln', name: 'Opt', set: 'xln', collector_number: '65' }]]));
  const hint = { name: 'Opt', set: 'XLN', collectorNumber: '65' };
  expect((await lookupCards([hint])).get('Opt')?.printings[0].scryfallId).toBe('xln');
  expect(fetchCollection).toHaveBeenCalledWith([hint], undefined);
});

it('expires session legalities at the original fetched time', async () => {
  vi.useFakeTimers();
  const name = 'Session TTL';
  vi.mocked(fetchCollection).mockResolvedValue(new Map([[name, { id: 'card', name, legalities: { modern: 'legal' } }]]));
  expect((await lookupCardsCached([name])).get(name)?.legalities).toEqual({ modern: 'legal' });
  await vi.advanceTimersByTimeAsync(SCRYFALL_CACHE_TTL_MS - 1);
  await lookupCardsCached([name]);
  expect(fetchCollection).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  vi.mocked(fetchCollection).mockResolvedValue(new Map([[name, { id: 'card', name, legalities: { modern: 'banned' } }]]));
  expect((await lookupCardsCached([name])).get(name)?.legalities).toEqual({ modern: 'banned' });
  expect(fetchCollection).toHaveBeenCalledTimes(2);
});

it('does not start a lookup cancelled during its database read', async () => {
  let resolve!: (value: undefined) => void;
  cards.get.mockReturnValue(new Promise((done) => {
    resolve = done;
  }));
  const controller = new AbortController();
  const result = lookupCard('Opt', controller.signal).catch((error: unknown) => error);
  controller.abort();
  resolve(undefined);
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(fetchNamedCard).not.toHaveBeenCalled();
});
