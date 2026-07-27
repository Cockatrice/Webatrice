import { useCallback, useSyncExternalStore } from 'react';

/**
 * Global toggle for the battlefield's snap-position dashed outlines.
 *
 * We ripped the always-on dashed grid out earlier (too noisy at scale),
 * but a debug/layout toggle is useful for verifying slot spacing when
 * the board is empty. The setting lives outside React state so a
 * TopBar toggle button and every mounted BattlefieldSlotOverlay share
 * the exact same value with no prop-drilling — `useSyncExternalStore`
 * subscribes each consumer to the same singleton.
 *
 * Persisted to localStorage so the choice survives reloads. Off by
 * default: the noisy grid should be opt-in.
 */
const STORAGE_KEY = 'webatrice.snapGridVisible';

function loadPersisted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persist(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* nothing we can do */
  }
}

let singleton: boolean = loadPersisted();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return singleton;
}

function getServerSnapshot(): boolean {
  return false;
}

/** Reactive read of the toggle. Every consumer re-renders when the
 *  singleton flips. */
export function useSnapGridVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Reactive read + setter. Only the toggle button needs the setter;
 *  passive consumers should use `useSnapGridVisible` on its own. */
export function useSnapGridSetting(): [boolean, (next: boolean) => void] {
  const value = useSnapGridVisible();
  const setValue = useCallback((next: boolean) => {
    if (next === singleton) return;
    singleton = next;
    persist(next);
    listeners.forEach((cb) => cb());
  }, []);
  return [value, setValue];
}
