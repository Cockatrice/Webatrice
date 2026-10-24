export type TaskOutcome = 'ok' | 'flood' | 'failed' | 'stop';
export type SettledOutcome = 'ok' | 'flood' | 'failed' | 'skipped';

export interface PacedQueueOptions<T = unknown> {
  intervalMs: number;
  floodBackoffMs: number;
  maxFloodRetries: number;
  isCancelled?: () => boolean;
  skip?: (item: T, index: number) => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface PacedQueueResult {
  completed: number;
  stopped: boolean;
}

export const SERVER_PACING = {
  intervalMs: 1200,
  floodBackoffMs: 10_000,
  maxFloodRetries: 3,
} as const;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runPaced<T>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<TaskOutcome>,
  onSettled: (item: T, index: number, outcome: SettledOutcome) => void,
  options: PacedQueueOptions<T>,
): Promise<PacedQueueResult> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  const cancelled = () => options.isCancelled?.() === true;
  let lastStart = -Infinity;
  for (let index = 0; index < items.length; index++) {
    if (cancelled()) {
      return { completed: index, stopped: true };
    }
    if (options.skip?.(items[index], index)) {
      onSettled(items[index], index, 'skipped');
      continue;
    }
    let floods = 0;
    for (;;) {
      const wait = lastStart + options.intervalMs - now();
      if (wait > 0) {
        await sleep(wait);
      }
      if (cancelled()) {
        return { completed: index, stopped: true };
      }
      lastStart = now();
      const outcome = await task(items[index], index);
      if (outcome === 'stop') {
        return { completed: index, stopped: true };
      }
      if (outcome === 'flood' && floods < options.maxFloodRetries) {
        floods += 1;
        await sleep(options.floodBackoffMs * floods);
        if (cancelled()) {
          onSettled(items[index], index, 'flood');
          return { completed: index + 1, stopped: true };
        }
        continue;
      }
      onSettled(items[index], index, outcome);
      break;
    }
  }
  return { completed: items.length, stopped: false };
}
