import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const DRAW_ANIMATION_MS = 450;

export interface DrawFlight {
  id: number;
  from: DOMRect;
  to: DOMRect;
  landed: boolean;
}

export interface UseDrawFlightsArgs {
  drawSeq: number;
  lastDrawCount: number;
  libraryRef: RefObject<HTMLElement | null>;
  handRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}

export function useDrawFlights({ drawSeq, lastDrawCount, libraryRef, handRef, enabled }: UseDrawFlightsArgs) {
  // In-flight draw animations. Purely visual: a card back tweens from
  // the library rect to the hand rect whenever this player's hand
  // count grows in Redux (a draw or mulligan just happened). Doesn't
  // touch any game state — the drawn card is already committed to
  // Redux by the time the animation starts; the flight is decoration
  // that fires alongside.
  const flightIdCounterRef = useRef(0);
  const [flights, setFlights] = useState<DrawFlight[]>([]);
  const pendingTimerIdsRef = useRef<Set<number>>(new Set());
  const pendingFrameIdsRef = useRef<Set<number>>(new Set());
  // Tracks the last observed `drawSeq` from Redux so the effect only fires
  // when the beacon actually ticks — not on unrelated re-renders.
  const prevDrawSeqForFlightRef = useRef<number | null>(null);

  const cancelPending = useCallback((clearFlights: boolean) => {
    for (const timerId of pendingTimerIdsRef.current) {
      window.clearTimeout(timerId);
    }
    pendingTimerIdsRef.current.clear();
    for (const frameId of pendingFrameIdsRef.current) {
      window.cancelAnimationFrame(frameId);
    }
    pendingFrameIdsRef.current.clear();
    if (clearFlights) {
      setFlights([]);
    }
  }, []);

  const scheduleTimer = useCallback((callback: () => void, delay: number) => {
    const timerId = window.setTimeout(() => {
      pendingTimerIdsRef.current.delete(timerId);
      callback();
    }, delay);
    pendingTimerIdsRef.current.add(timerId);
  }, []);

  const scheduleFrame = useCallback((callback: FrameRequestCallback) => {
    const frameId = window.requestAnimationFrame((time) => {
      pendingFrameIdsRef.current.delete(frameId);
      callback(time);
    });
    pendingFrameIdsRef.current.add(frameId);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cancelPending(true);
    }
  }, [cancelPending, enabled]);

  useEffect(() => () => cancelPending(false), [cancelPending]);

  // Fire flight animations from the library rect to the hand rect only
  // when the Redux draw beacon (`drawSeq`) ticks. The beacon is bumped
  // exclusively by the cardsDrawn listener (Event_DrawCards), so drags
  // from other zones into the hand — which grow `handCount` too — never
  // trigger this. `lastDrawCount` says how many flights to spawn. Each
  // seat measures against its OWN library/hand rects, so it works
  // for self draws (Ctrl+D, mulligan, opening hand) and opponents alike.
  // Guards: skip on first render (no baseline), skip if refs aren't
  // measurable, skip if the beacon didn't actually tick.
  useEffect(() => {
    const currentSeq = drawSeq ?? 0;
    const prev = prevDrawSeqForFlightRef.current;
    prevDrawSeqForFlightRef.current = currentSeq;
    if (prev === null) {
      return;
    } // first render — establish baseline only
    if (currentSeq <= prev || !enabled) {
      return;
    }
    const drawn = lastDrawCount ?? 0;
    if (drawn <= 0) {
      return;
    }
    const libEl = libraryRef.current;
    const handEl = handRef.current;
    if (!libEl || !handEl) {
      return;
    }
    const from = libEl.getBoundingClientRect();
    const to = handEl.getBoundingClientRect();
    if (from.width === 0 || to.width === 0) {
      return;
    }
    for (let i = 0; i < drawn; i++) {
      const id = ++flightIdCounterRef.current;
      const startDelay = i * 90;
      scheduleTimer(() => {
        setFlights((prev) => [...prev, { id, from, to, landed: false }]);
        // Two rAFs so the initial style commits before the transition
        // target is set — otherwise browsers may collapse both frames
        // and skip the animation.
        scheduleFrame(() => {
          scheduleFrame(() => {
            setFlights((prev) =>
              prev.map((f) => (f.id === id ? { ...f, landed: true } : f)),
            );
          });
        });
        scheduleTimer(() => {
          setFlights((prev) => prev.filter((f) => f.id !== id));
        }, DRAW_ANIMATION_MS + 50);
      }, startDelay);
    }
  }, [drawSeq, lastDrawCount, libraryRef, handRef, enabled, scheduleFrame, scheduleTimer]);

  return { flights, DRAW_ANIMATION_MS };
}
