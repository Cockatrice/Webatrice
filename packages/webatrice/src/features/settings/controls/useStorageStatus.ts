import { useSyncExternalStore } from 'react';

import {
  countStoredRecords,
  estimateStorage,
  isStoragePersisted,
  type StorageUsage,
  type Stores,
} from '@app/services';

export interface StorageStatus {
  loaded: boolean;
  usage: StorageUsage | null;
  counts: Partial<Record<Stores, number>>;
  persisted: boolean | null;
}

const INITIAL: StorageStatus = { loaded: false, usage: null, counts: {}, persisted: null };

let status: StorageStatus = INITIAL;
let generation = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) {
    void refreshStorageStatus();
  }
  return () => {
    listeners.delete(listener);
  };
};

export function refreshStorageStatus(): Promise<void> {
  const read = ++generation;
  const apply = (next: StorageStatus) => {
    if (read === generation) {
      status = next;
      listeners.forEach((listener) => listener());
    }
  };
  return Promise.allSettled([estimateStorage(), countStoredRecords(), isStoragePersisted()]).then(
    ([usage, counts, persisted]) => apply({
      loaded: true,
      usage: usage.status === 'fulfilled' ? usage.value : status.usage,
      counts: counts.status === 'fulfilled' ? counts.value : status.counts,
      persisted: persisted.status === 'fulfilled' ? persisted.value : status.persisted,
    }),
  );
}

export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(subscribe, () => status);
}

export function resetStorageStatus(): void {
  status = INITIAL;
  generation = 0;
}
