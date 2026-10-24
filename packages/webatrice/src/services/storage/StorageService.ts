import { dexieService, Stores, USER_TOKENS_SOURCE_ID, type CardSourcePayload } from '../dexie';

export const CARD_DATA_STORES: readonly Stores[] = [
  Stores.CARDS,
  Stores.SETS,
  Stores.TOKENS,
  Stores.FORMATS,
  Stores.INFO,
  Stores.CARD_SOURCES,
  Stores.CARD_SOURCE_PAYLOADS,
];

export const CARD_PREFERENCE_STORES: readonly Stores[] = [Stores.SET_PREFERENCES, Stores.CARD_DATA_SETTINGS];

export const SCRYFALL_CACHE_STORES: readonly Stores[] = [Stores.SCRYFALL_CACHE];

export const REPLAY_STORES: readonly Stores[] = [Stores.REPLAYS, Stores.REPLAY_DATA];

export const ALL_STORES: readonly Stores[] = [
  ...CARD_DATA_STORES,
  ...CARD_PREFERENCE_STORES,
  ...SCRYFALL_CACHE_STORES,
  ...REPLAY_STORES,
  Stores.HOSTS,
  Stores.SETTINGS,
];

export interface StorageUsage {
  usage: number;
  quota: number;
}

const storageManager = (): StorageManager | undefined =>
  typeof navigator === 'undefined' ? undefined : navigator.storage;

export async function estimateStorage(): Promise<StorageUsage | null> {
  const estimate = await storageManager()?.estimate?.();
  if (estimate?.usage == null || estimate.quota == null) {
    return null;
  }
  return { usage: estimate.usage, quota: estimate.quota };
}

export async function isStoragePersisted(): Promise<boolean | null> {
  const manager = storageManager();
  return manager?.persisted ? manager.persisted() : null;
}

export async function requestPersistentStorage(): Promise<boolean> {
  const manager = storageManager();
  return manager?.persist ? manager.persist() : false;
}

export function isPersistentStorageSupported(): boolean {
  return typeof storageManager()?.persist === 'function';
}

export async function countStoredRecords(): Promise<Record<Stores, number>> {
  const counts = await Promise.all(ALL_STORES.map((store) => dexieService.count(store)));
  return Object.fromEntries(ALL_STORES.map((store, i) => [store, counts[i]])) as Record<Stores, number>;
}

export const clearScryfallCache = (): Promise<void> => dexieService.clear(SCRYFALL_CACHE_STORES);

export function clearCardData(): Promise<void> {
  return dexieService.cardDataTransaction(async () => {
    const userTokens: CardSourcePayload | undefined = await dexieService.cardSourcePayloads.get(USER_TOKENS_SOURCE_ID);
    await Promise.all([
      dexieService.cards.clear(),
      dexieService.sets.clear(),
      dexieService.tokens.clear(),
      dexieService.formats.clear(),
      dexieService.info.clear(),
      dexieService.cardSources.where('id').notEqual(USER_TOKENS_SOURCE_ID).delete(),
      dexieService.cardSourcePayloads.where('id').notEqual(USER_TOKENS_SOURCE_ID).delete(),
    ]);
    if (userTokens?.records) {
      await Promise.all([
        dexieService.tokens.bulkPut(userTokens.records.tokens),
        dexieService.sets.bulkPut(userTokens.records.sets),
      ]);
    }
  });
}
