import type { Mock } from 'vitest';

import { dexieService } from '../../dexie';
import {
  bulkGetFromScryfallCache,
  bulkPutScryfallCache,
  getFromScryfallCache,
  isScryfallCacheFresh,
  putScryfallCache,
  SCRYFALL_CACHE_TTL_MS,
} from './scryfallCache';
import type { LookupResult } from './types';

vi.mock('../../dexie', () => ({
  dexieService: { scryfallCache: { get: vi.fn(), bulkGet: vi.fn(), put: vi.fn(), bulkPut: vi.fn() } },
}));

const cache = dexieService.scryfallCache as unknown as { get: Mock; bulkGet: Mock; put: Mock; bulkPut: Mock };

const NOW = new Date('2026-10-10T00:00:00.000Z');
const WITH_COMBO: LookupResult = {
  found: true,
  source: 'scryfall',
  name: 'Command Tower',
  printings: [{ set: 'CMM', collectorNumber: '396', scryfallId: 'tower-id' }],
  related: [{ name: 'Tower Winder', component: 'combo_piece', origin: 'scryfall' }],
};

function cached(result: LookupResult, fetchedAt = NOW.getTime()): LookupResult & { fetchedAt: number } {
  return { ...result, fetchedAt };
}

describe('scryfallCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns fresh rows and drops stale combo pieces on read', async () => {
    const fresh = cached(WITH_COMBO);
    cache.get.mockResolvedValue(fresh);
    cache.bulkGet.mockResolvedValue([fresh, undefined]);

    await expect(getFromScryfallCache('Command Tower')).resolves.toEqual({
      ...fresh,
      related: undefined,
    });
    await expect(bulkGetFromScryfallCache(['Command Tower', 'Missing'])).resolves.toEqual([
      { ...fresh, related: undefined },
      undefined,
    ]);
  });

  it('retains stale and legacy rows for fallback while marking them for refresh', async () => {
    const stale = cached(WITH_COMBO, NOW.getTime() - SCRYFALL_CACHE_TTL_MS);
    const future = cached(WITH_COMBO, NOW.getTime() + 1);
    const invalid = cached(WITH_COMBO, Number.NaN);
    cache.get
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(WITH_COMBO)
      .mockResolvedValueOnce(future)
      .mockResolvedValueOnce(invalid);
    cache.bulkGet.mockResolvedValue([stale, WITH_COMBO]);

    await expect(getFromScryfallCache('Stale')).resolves.toEqual({ ...stale, related: undefined });
    await expect(getFromScryfallCache('Legacy')).resolves.toEqual({ ...WITH_COMBO, related: undefined });
    await expect(getFromScryfallCache('Future')).resolves.toEqual({ ...future, related: undefined });
    await expect(getFromScryfallCache('Invalid')).resolves.toEqual({ ...invalid, related: undefined });
    await expect(bulkGetFromScryfallCache(['Stale', 'Legacy'])).resolves.toEqual([
      { ...stale, related: undefined }, { ...WITH_COMBO, related: undefined },
    ]);
    for (const row of [stale, WITH_COMBO, future, invalid]) {
      expect(isScryfallCacheFresh(row)).toBe(false);
    }
    expect(isScryfallCacheFresh(cached(WITH_COMBO, NOW.getTime() - SCRYFALL_CACHE_TTL_MS + 1))).toBe(true);
  });

  it('requires a cached printing to match set and collector hints', async () => {
    const fresh = cached(WITH_COMBO);
    cache.get.mockResolvedValue(fresh);
    cache.bulkGet.mockResolvedValue([fresh, fresh]);

    await expect(
      getFromScryfallCache('Command Tower', { set: 'cmm', collectorNumber: '396' }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Command Tower' }));
    await expect(
      getFromScryfallCache('Command Tower', { set: 'LTC', collectorNumber: '396' }),
    ).resolves.toBeUndefined();
    await expect(
      getFromScryfallCache('Command Tower', { collectorNumber: '396' }),
    ).resolves.toBeDefined();
    await expect(
      getFromScryfallCache('Command Tower', { collectorNumber: '999' }),
    ).resolves.toBeUndefined();
    await expect(
      bulkGetFromScryfallCache(
        ['Command Tower', 'Command Tower'],
        [
          { set: 'CMM', collectorNumber: '396' },
          { set: 'CMM', collectorNumber: '999' },
        ],
      ),
    ).resolves.toEqual([expect.objectContaining({ name: 'Command Tower' }), undefined]);
  });

  it('requires a cached printing to match a Scryfall id hint', async () => {
    const fresh = cached(WITH_COMBO);
    cache.get.mockResolvedValue(fresh);

    await expect(getFromScryfallCache('Command Tower', { scryfallId: 'tower-id' })).resolves.toBeDefined();
    await expect(getFromScryfallCache('Command Tower', { scryfallId: 'other-id' })).resolves.toBeUndefined();
  });

  it('stamps writes without mutating caller-owned results', async () => {
    const second = { ...WITH_COMBO, name: 'Sol Ring', fetchedAt: NOW.getTime() - 1_000 };

    await putScryfallCache(WITH_COMBO);
    await bulkPutScryfallCache([WITH_COMBO, second]);

    expect(cache.put).toHaveBeenCalledWith({ ...WITH_COMBO, fetchedAt: NOW.getTime() });
    expect(cache.bulkPut).toHaveBeenCalledWith([
      { ...WITH_COMBO, fetchedAt: NOW.getTime() },
      second,
    ]);
    expect(WITH_COMBO).not.toHaveProperty('fetchedAt');
    expect(second.fetchedAt).toBe(NOW.getTime() - 1_000);
  });

  it('reads a failing table as misses', async () => {
    cache.get.mockRejectedValue(new Error('blocked'));
    cache.bulkGet.mockRejectedValue(new Error('blocked'));

    await expect(getFromScryfallCache('Opt')).resolves.toBeUndefined();
    await expect(bulkGetFromScryfallCache(['Opt', 'Ponder'])).resolves.toEqual([undefined, undefined]);
  });

  it('retains earlier printing ids when ordinary refreshes overwrite the named card', async () => {
    const old = { ...WITH_COMBO, printings: [{ scryfallId: 'pinned' }] };
    cache.get.mockResolvedValue(old);
    cache.bulkGet.mockResolvedValue([old]);
    await putScryfallCache(WITH_COMBO);
    await bulkPutScryfallCache([WITH_COMBO]);
    const expected = expect.objectContaining({ printings: [...WITH_COMBO.printings, ...old.printings] });
    expect(cache.put).toHaveBeenCalledWith(expected);
    expect(cache.bulkPut).toHaveBeenCalledWith([expected]);
  });

  it('swallows write failures and skips an empty bulk write', async () => {
    cache.put.mockRejectedValue(new Error('quota'));
    cache.bulkPut.mockRejectedValue(new Error('quota'));

    await expect(putScryfallCache(WITH_COMBO)).resolves.toBeUndefined();
    await expect(bulkPutScryfallCache([WITH_COMBO])).resolves.toBeUndefined();
    cache.bulkPut.mockClear();
    await bulkPutScryfallCache([]);
    expect(cache.bulkPut).not.toHaveBeenCalled();
  });
});
