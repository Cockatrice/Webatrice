const REQUEST_SPACING_MS = 100;
const MAX_RETRY_WAIT_MS = 60_000;
const MAX_RETRIES = 2;

export class ScryfallRateLimitError extends Error {
  readonly status = 429;

  constructor() {
    super('Scryfall request limit exceeded');
    this.name = 'ScryfallRateLimitError';
  }
}

export function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    throw abortError();
  }
}

export function rethrowCancellationOrRateLimit(error: unknown): void {
  if (error instanceof ScryfallRateLimitError || (error as { name?: string })?.name === 'AbortError') {
    throw error;
  }
}

function retryDelay(header: string | null): number {
  const value = header?.trim();
  const delay = value && /^\d+(?:\.\d+)?$/.test(value)
    ? Number(value) * 1000
    : value ? Date.parse(value) - Date.now() : NaN;
  return Number.isNaN(delay) ? 1000 : Math.min(MAX_RETRY_WAIT_MS, Math.max(0, delay));
}

interface Job {
  url: string;
  init?: RequestInit;
  retries: number;
  settled: boolean;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
}

export function createScryfallScheduler() {
  const queue: Job[] = [];
  let nextStart = 0;
  let pausedUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function finish(job: Job, response?: Response, error?: unknown) {
    if (job.settled) {
      return;
    }
    job.settled = true;
    job.cleanup();
    if (response) {
      job.resolve(response);
    } else {
      job.reject(error);
    }
  }

  function pump() {
    clearTimeout(timer);
    timer = undefined;
    if (!queue.length) {
      return;
    }
    const delay = Math.max(nextStart, pausedUntil) - Date.now();
    if (delay > 0) {
      timer = setTimeout(pump, delay);
      return;
    }
    const job = queue.shift()!;
    nextStart = Date.now() + REQUEST_SPACING_MS;
    void (async () => {
      try {
        const response = await fetch(job.url, job.init);
        if (response.status === 429) {
          pausedUntil = Math.max(pausedUntil, Date.now() + retryDelay(response.headers?.get('Retry-After') ?? null));
          void response.body?.cancel().catch(() => {});
          if (!job.settled && job.retries++ < MAX_RETRIES) {
            queue.unshift(job);
          } else {
            finish(job, undefined, new ScryfallRateLimitError());
          }
        } else {
          finish(job, response);
        }
      } catch (error) {
        finish(job, undefined, error);
      } finally {
        pump();
      }
    })();
    pump();
  }

  return (url: string, init?: RequestInit): Promise<Response> => new Promise((resolve, reject) => {
    if (init?.signal?.aborted) {
      reject(abortError());
      return;
    }
    const job: Job = { url, init, retries: 0, settled: false, resolve, reject, cleanup: () => {} };
    const abort = () => {
      const index = queue.indexOf(job);
      if (index !== -1) {
        queue.splice(index, 1);
      }
      finish(job, undefined, abortError());
      pump();
    };
    job.cleanup = () => init?.signal?.removeEventListener('abort', abort);
    init?.signal?.addEventListener('abort', abort, { once: true });
    queue.push(job);
    pump();
  });
}

export const scheduleScryfallRequest = createScryfallScheduler();
