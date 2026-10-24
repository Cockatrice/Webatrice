import { dexieService, Stores } from '../dexie';
import {
  ALL_STORES,
  CARD_DATA_STORES,
  clearScryfallCache,
  countStoredRecords,
  estimateStorage,
  isPersistentStorageSupported,
  isStoragePersisted,
  requestPersistentStorage,
} from './StorageService';

const installStorageManager = (manager: Partial<StorageManager> | undefined) => {
  Object.defineProperty(navigator, 'storage', { configurable: true, value: manager });
};

describe('StorageService', () => {
  afterEach(() => {
    delete (navigator as { storage?: unknown }).storage;
  });

  describe('estimateStorage', () => {
    test('reports usage and quota from navigator.storage.estimate', async () => {
      installStorageManager({ estimate: vi.fn().mockResolvedValue({ usage: 5_242_880, quota: 1_073_741_824 }) });

      await expect(estimateStorage()).resolves.toEqual({ usage: 5_242_880, quota: 1_073_741_824 });
    });

    test('is null where the browser has no StorageManager or omits a figure', async () => {
      installStorageManager(undefined);
      await expect(estimateStorage()).resolves.toBeNull();

      installStorageManager({ estimate: vi.fn().mockResolvedValue({ quota: 100 }) });
      await expect(estimateStorage()).resolves.toBeNull();
    });
  });

  describe('persistence', () => {
    test('reads and requests persistence through the StorageManager', async () => {
      const persist = vi.fn().mockResolvedValue(true);
      installStorageManager({ persisted: vi.fn().mockResolvedValue(false), persist });

      expect(isPersistentStorageSupported()).toBe(true);
      await expect(isStoragePersisted()).resolves.toBe(false);
      await expect(requestPersistentStorage()).resolves.toBe(true);
      expect(persist).toHaveBeenCalledTimes(1);
    });

    test('degrades where the browser cannot persist', async () => {
      installStorageManager(undefined);

      expect(isPersistentStorageSupported()).toBe(false);
      await expect(isStoragePersisted()).resolves.toBeNull();
      await expect(requestPersistentStorage()).resolves.toBe(false);
    });
  });

  test('counts every table', async () => {
    vi.spyOn(dexieService, 'count').mockImplementation(async (store) => (store === Stores.CARDS ? 30_000 : 1));

    const counts = await countStoredRecords();

    expect(Object.keys(counts).sort()).toEqual([...ALL_STORES].sort());
    expect(counts[Stores.CARDS]).toBe(30_000);
  });

  test('clears the Scryfall cache on its own', async () => {
    const clear = vi.spyOn(dexieService, 'clear').mockResolvedValue();

    await clearScryfallCache();

    expect(clear).toHaveBeenCalledWith([Stores.SCRYFALL_CACHE]);
  });

  test('groups every imported card table and the files they were built from, and never preferences, settings or hosts', () => {
    expect(CARD_DATA_STORES).toEqual(expect.arrayContaining([
      Stores.CARDS,
      Stores.SETS,
      Stores.TOKENS,
      Stores.FORMATS,
      Stores.INFO,
      Stores.CARD_SOURCES,
      Stores.CARD_SOURCE_PAYLOADS,
    ]));
    expect(CARD_DATA_STORES).not.toContain(Stores.SET_PREFERENCES);
    expect(CARD_DATA_STORES).not.toContain(Stores.CARD_DATA_SETTINGS);
    expect(CARD_DATA_STORES).not.toContain(Stores.SETTINGS);
    expect(CARD_DATA_STORES).not.toContain(Stores.HOSTS);
  });
});
