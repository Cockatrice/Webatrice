import { useCallback, useSyncExternalStore } from 'react';

import { readLocalStorage, writeLocalStorage } from '@app/services';

import { detectTransientTab, isStickyTabType, type Tab, type TabType } from '../topBarTabs';

const STICKY_STORAGE_KEY = 'webatrice.stickyTabs';

export type StickyTabsUpdater = (prev: Tab[]) => Tab[];

export function isValidPersistedTab(t: unknown): t is Tab {
  if (!t || typeof t !== 'object') {
    return false;
  }
  const rec = t as Record<string, unknown>;
  return (
    typeof rec.key === 'string' &&
    (typeof rec.title === 'string' || typeof rec.titleKey === 'string') &&
    typeof rec.route === 'string' &&
    typeof rec.closeable === 'boolean' &&
    typeof rec.type === 'string' &&
    isStickyTabType(rec.type as TabType)
  );
}

function retitleLegacyTab(tab: Tab): Tab {
  if (tab.titleKey !== undefined) {
    return tab;
  }
  const derived = detectTransientTab(tab.route);
  return derived && derived.key === tab.key ? derived : tab;
}

function loadPersistedStickyTabs(): Tab[] {
  const raw = readLocalStorage(STICKY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isValidPersistedTab).map(retitleLegacyTab) : [];
  } catch {
    return [];
  }
}

function persistStickyTabs(tabs: Tab[]): void {
  // Strip onClose (functions don't survive JSON) before writing.
  const serializable = tabs.map(({ key, type, title, titleKey, titleParams, route, closeable }) => ({
    key, type, title, titleKey, titleParams, route, closeable,
  }));
  writeLocalStorage(STICKY_STORAGE_KEY, JSON.stringify(serializable));
}

let stickyTabs: Tab[] = loadPersistedStickyTabs();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Tab[] {
  return stickyTabs;
}

export function useStickyTabs(): [Tab[], (updater: StickyTabsUpdater) => void] {
  const tabs = useSyncExternalStore(subscribe, getSnapshot);
  const update = useCallback((updater: StickyTabsUpdater) => {
    const next = updater(stickyTabs);
    if (next === stickyTabs) {
      return;
    }
    stickyTabs = next;
    persistStickyTabs(next);
    listeners.forEach((cb) => cb());
  }, []);
  return [tabs, update];
}
