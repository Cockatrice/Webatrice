import { useCallback, useSyncExternalStore } from 'react';

import { TALLY_TYPES, type TallyType } from '../utils/tally';

const STORAGE_KEY = 'webatrice.tallyType';

function loadPersisted(): TallyType {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return TALLY_TYPES.find((t) => t === raw) ?? 'none';
  } catch {
    return 'none';
  }
}

let singleton: TallyType = loadPersisted();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => singleton;

export function useTallyType(): [TallyType, (next: TallyType) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback((next: TallyType) => {
    if (next === singleton) {
      return;
    }
    singleton = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still holds for this session.
    }
    listeners.forEach((cb) => cb());
  }, []);
  return [value, setValue];
}
