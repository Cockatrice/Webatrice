export const LOAD_TIMINGS = ['boot-start', 'app-render', 'websocket-open', 'login-response', 'home-data', 'route-ready'] as const;
export type LoadTiming = typeof LOAD_TIMINGS[number];

const prefix = 'webatrice:';

export function markLoadTiming(name: LoadTiming, detail?: string, replace = false): void {
  if (typeof performance?.mark !== 'function' || typeof performance?.measure !== 'function') {
    return;
  }
  const key = prefix + name;
  if (!replace && performance.getEntriesByName(key, 'mark').length) {
    return;
  }
  performance.clearMarks(key);
  performance.clearMeasures(key);
  performance.mark(key, { detail });
  const boot = performance.getEntriesByName(prefix + 'boot-start', 'mark')[0];
  if (boot) {
    performance.measure(key, { start: boot.startTime, end: key, detail });
  }
}

export function readLoadTimings() {
  return LOAD_TIMINGS.map((name) => {
    const key = prefix + name;
    const mark = performance.getEntriesByName?.(key, 'mark')[0] as PerformanceMark | undefined;
    const measure = performance.getEntriesByName?.(key, 'measure')[0];
    return {
      name,
      milliseconds: measure?.duration ?? (name === 'boot-start' && mark ? 0 : undefined),
      detail: mark?.detail as string | undefined,
    };
  });
}
