import { useCallback, useSyncExternalStore } from 'react';

import { readLocalStorage, writeLocalStorage } from '@app/services';

const STORAGE_KEY = 'webatrice.navRailHidden';

let hidden = readLocalStorage(STORAGE_KEY) === 'true';
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => hidden;

export function useNavRailHidden(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot);
  const setHidden = useCallback((next: boolean) => {
    if (next === hidden) {
      return;
    }
    hidden = next;
    writeLocalStorage(STORAGE_KEY, String(next));
    listeners.forEach((cb) => cb());
  }, []);
  return [value, setHidden];
}
