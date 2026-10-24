import { useCallback, useEffect, useRef, useState } from 'react';

export interface MarqueeRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Marquee<S> {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  start: S;
  count: number;
}

export interface UseMarqueeOptions {
  blockTextSelection?: boolean;
}

export function useMarquee<S>(
  select: (rect: MarqueeRect, start: S) => number,
  { blockTextSelection = false }: UseMarqueeOptions = {},
) {
  const [marquee, setMarquee] = useState<Marquee<S> | null>(null);
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });

  useEffect(() => {
    if (!marquee) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      const count = selectRef.current({
        left: Math.min(marquee.x1, e.clientX),
        right: Math.max(marquee.x1, e.clientX),
        top: Math.min(marquee.y1, e.clientY),
        bottom: Math.max(marquee.y1, e.clientY),
      }, marquee.start);
      setMarquee((m) => (m ? { ...m, x2: e.clientX, y2: e.clientY, count } : null));
    };
    const onUp = () => setMarquee(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [marquee]);

  const active = marquee !== null;
  useEffect(() => {
    if (!blockTextSelection || !active) {
      return;
    }
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [blockTextSelection, active]);

  const begin = useCallback((point: { clientX: number; clientY: number }, start: S) => {
    setMarquee({ x1: point.clientX, y1: point.clientY, x2: point.clientX, y2: point.clientY, start, count: 0 });
  }, []);

  return { marquee, begin };
}
