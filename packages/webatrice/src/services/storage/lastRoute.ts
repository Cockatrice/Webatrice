import { readLocalStorage, writeLocalStorage } from './localStorage';

const LAST_ROUTE_STORAGE_KEY = 'webatrice.lastRoute';

export function persistLastRoute(pathname: string): void {
  writeLocalStorage(LAST_ROUTE_STORAGE_KEY, pathname);
}

export function loadPersistedLastRoute(): string | null {
  return readLocalStorage(LAST_ROUTE_STORAGE_KEY);
}
