import { useEffect, useRef, useState } from 'react';

const MS_PER_PIXEL = 0.8;
const MIN_STROKE_MS = 200;
const MAX_STROKE_MS = 450;

export function arrowStrokeDurationMs(lengthPx: number): number {
  return Math.min(MAX_STROKE_MS, Math.max(MIN_STROKE_MS, lengthPx * MS_PER_PIXEL));
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function useArrowDrawIn(animate: boolean, lengthPx: number): number {
  const [progress, setProgress] = useState(animate ? 0 : 1);
  const durationMs = useRef(arrowStrokeDurationMs(lengthPx));
  const started = useRef(animate);

  useEffect(() => {
    if (!started.current) {
      return;
    }
    let frame = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / durationMs.current);
      setProgress(easeOutCubic(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return progress;
}

export function useArrivingArrows(
  gameArrowKeys: ReadonlySet<string> | null,
  drawnKeys: readonly string[],
): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null && gameArrowKeys !== null) {
    seen.current = new Set(gameArrowKeys);
  }
  const arriving = new Set(seen.current ? drawnKeys.filter((key) => !seen.current!.has(key)) : []);

  useEffect(() => {
    if (!seen.current || !gameArrowKeys) {
      return;
    }
    for (const key of seen.current) {
      if (!gameArrowKeys.has(key)) {
        seen.current.delete(key);
      }
    }
    drawnKeys.forEach((key) => seen.current!.add(key));
  });

  return arriving;
}
