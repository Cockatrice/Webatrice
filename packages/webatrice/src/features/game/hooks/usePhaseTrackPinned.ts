import { useCallback, useSyncExternalStore } from 'react';

/**
 * Global toggle for the phase-track's "pinned open" mode.
 *
 * Pinned (`true`, default): the phase track is always fully expanded
 * and occupies a fixed left column in the game grid — no floating,
 * no hover animation. The play area shrinks by the track's width in
 * exchange for the track always being fully readable.
 *
 * Auto-hide (`false`): the phase track lives on the left edge as an
 * 8-px auto-collapsing HUD; it expands over the play area on hover
 * and re-collapses on mouse-out, so the board fills the full width.
 *
 * Same singleton + `useSyncExternalStore` + localStorage pattern as
 * `useSnapGridVisible` — the setting is per-user and needs to survive
 * reloads, TopBar remounts, and each PhaseTrack remount (Layout
 * re-mounts on every navigation).
 */
const STORAGE_KEY = 'webatrice.phaseTrackPinned';

function loadPersisted(): boolean {
  // Default to pinned when nothing is stored yet — new users see the
  // fully-expanded track. Users who've explicitly turned auto-hide on
  // (persisted "0") get their preference back on reload.
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw === '1';
  } catch {
    return true;
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

/** Reactive read of the pinned flag. */
export function usePhaseTrackPinned(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Reactive read + setter. Only the TopBar toggle needs the setter;
 *  passive consumers (PhaseTrack, Game grid) should use
 *  `usePhaseTrackPinned` on its own. */
export function usePhaseTrackPinnedSetting(): [boolean, (next: boolean) => void] {
  const value = usePhaseTrackPinned();
  const setValue = useCallback((next: boolean) => {
    if (next === singleton) return;
    singleton = next;
    persist(next);
    listeners.forEach((cb) => cb());
  }, []);
  return [value, setValue];
}
