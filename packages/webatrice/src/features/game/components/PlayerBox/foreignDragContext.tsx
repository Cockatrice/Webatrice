import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

type HandCard = { id: string; name: string; scryfallId: string };
type DragSourceZone =
  | 'battlefield'
  | 'hand'
  | 'library'
  | 'graveyard'
  | 'exile'
  | 'stack';

/**
 * Callback matching PlayerBox's internal `beginDrag`. Kept as a bare
 * function type so we don't couple this context to PlayerBox's props
 * file.
 */
type BeginDragFn = (
  e: React.PointerEvent<HTMLElement>,
  cards: HandCard[],
  sourceZone: DragSourceZone,
  sourcePlayerId?: number,
) => void;

/**
 * Shared handle so components outside the local PlayerBox subtree
 * (e.g. IncomingRevealDialog, which is portaled at Game.tsx level)
 * can start a drag that lands on the local player's drag
 * infrastructure — ghost, pointer tracking, drop hit-testing,
 * applyMove wire dispatch — without duplicating any of it.
 *
 * The local (isSelf) PlayerBox registers its `beginDrag` here on
 * mount via `useRegisterForeignDrag`. Consumers call
 * `useForeignDrag()` and invoke the returned callback on
 * pointerdown, passing the lender's player id as `sourcePlayerId`.
 *
 * The registry is a ref rather than context state so re-registering
 * doesn't cause consumers to re-render — the callback is a moving
 * target, but consumers only care about it at pointerdown time.
 */
type Registry = { beginForeignDrag: BeginDragFn | null };

const ForeignDragContext = createContext<Registry | null>(null);

export function ForeignDragProvider({ children }: { children: ReactNode }) {
  // useMemo so the same registry object survives re-renders — the ref
  // inside is what actually mutates.
  const registry = useMemo<Registry>(() => ({ beginForeignDrag: null }), []);
  return (
    <ForeignDragContext.Provider value={registry}>
      {children}
    </ForeignDragContext.Provider>
  );
}

/**
 * Hook for the local PlayerBox to register its `beginDrag` in the
 * provider. Called with the function directly (not via effect) so a
 * remount / callback swap propagates immediately. Passing `null`
 * unregisters — do this in the cleanup path if a non-self PlayerBox
 * ever becomes local (rare, but keeps the registry accurate).
 */
export function useRegisterForeignDrag(beginDrag: BeginDragFn | null): void {
  const registry = useContext(ForeignDragContext);
  // useRef trick to write during render without triggering warnings.
  // The registry mutation is fine because the ref target is stable
  // and consumers read it lazily (at pointerdown time), not during
  // render.
  const prevRef = useRef<BeginDragFn | null>(null);
  if (registry && prevRef.current !== beginDrag) {
    registry.beginForeignDrag = beginDrag;
    prevRef.current = beginDrag;
  }
}

/**
 * Consumer hook. Returns a stable function that starts a foreign
 * drag on the local PlayerBox, or a no-op if no local PlayerBox is
 * currently registered (e.g. we're a pure spectator with no seat).
 */
export function useForeignDrag(): BeginDragFn {
  const registry = useContext(ForeignDragContext);
  return useMemo<BeginDragFn>(
    () => (e, cards, sourceZone, sourcePlayerId) => {
      registry?.beginForeignDrag?.(e, cards, sourceZone, sourcePlayerId);
    },
    [registry],
  );
}
