import { useCallback, useEffect, useState } from 'react';

// Range clamps for the resizable right rail. 240 keeps the card preview
// legible; 600 caps at "about half a wide viewport" so the play area
// can't get squeezed to nothing.
export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 600;
export const SIDEBAR_WIDTH_DEFAULT = 288;

const STORAGE_KEY = 'webatrice.gameSidebarWidth';

function readPersistedWidth(): number {
  if (typeof window === 'undefined') return SIDEBAR_WIDTH_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SIDEBAR_WIDTH_DEFAULT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return SIDEBAR_WIDTH_DEFAULT;
    return clamp(parsed);
  } catch {
    return SIDEBAR_WIDTH_DEFAULT;
  }
}

function clamp(width: number): number {
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, Math.round(width)));
}

/**
 * Width (in px) of the BattlefieldSidebar column, with a drag-resizer
 * handle mounted at its left edge (see `SidebarResizer`). Persisted to
 * localStorage so the user's choice survives refresh and re-joining
 * the game. Callers set the width by setState from a pointermove
 * handler; the hook clamps to [MIN, MAX] and writes-through on every
 * commit.
 */
export function useSidebarWidth(): {
  width: number;
  setWidth: (next: number) => void;
} {
  const [width, setWidthState] = useState<number>(readPersistedWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      // Quota / private mode — drop silently, the runtime state stays valid.
    }
  }, [width]);

  const setWidth = useCallback((next: number) => {
    setWidthState(clamp(next));
  }, []);

  return { width, setWidth };
}
