import { useCallback, useSyncExternalStore } from 'react';

/**
 * Cross-PlayerBox selection ownership singleton. Each PlayerBox owns
 * its own `selection` state, but only ONE box can hold a non-null
 * selection at a time — clicking / marqueeing anywhere else (own or
 * opponent) should clear the previous selection.
 *
 * Implementation: a module-level singleton subscribed to via
 * `useSyncExternalStore`. When a PlayerBox transitions to having a
 * selection, it claims ownership (`setSelectionOwner(playerId)`).
 * Other PlayerBoxes' effects notice the ownership change and drop
 * their own selection. Clicking empty space explicitly releases
 * ownership so previously-selected boxes clear.
 *
 * A React context would work too, but the tree of PlayerBoxes is
 * rendered inside several intermediate components (Battlefield,
 * GameBoardCell) and threading a provider is more plumbing than the
 * feature deserves. The singleton has no lifecycle concerns because
 * the whole game is torn down when the tab closes.
 */
let currentOwner: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number | null {
  return currentOwner;
}

export function useSelectionOwner(): [
  number | null,
  (ownerPlayerId: number | null) => void,
] {
  const owner = useSyncExternalStore(subscribe, getSnapshot);
  const setOwner = useCallback((ownerPlayerId: number | null) => {
    if (currentOwner === ownerPlayerId) {
      return;
    }
    currentOwner = ownerPlayerId;
    listeners.forEach((l) => l());
  }, []);
  return [owner, setOwner];
}
