import type { TickMessage, WorkerMessage } from './keepAliveWorkerHandler';

const DEGRADED_AFTER_MISSES = 2;
const MISS_MIN_AGE_FACTOR = 0.9;

export type KeepAliveHealthChange = (missedPongs: number, silentForMs: number) => void;

export class KeepAliveService {
  private isOpen: () => boolean;
  private onHealthChange: KeepAliveHealthChange;

  private worker: Worker | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingPending = false;
  private currentPing: ((onPong: () => void) => void) | null = null;
  private boundHandleMessage: (event: MessageEvent) => void;

  private missedPongs = 0;
  private interval = 0;
  private lastPingSentAt: number | null = null;
  private lastPongAt: number | null = null;

  constructor(isOpen: () => boolean, onHealthChange: KeepAliveHealthChange) {
    this.isOpen = isOpen;
    this.onHealthChange = onHealthChange;
    this.boundHandleMessage = this.handleMessage.bind(this);
  }

  public startPingLoop(interval: number, ping: (onPong: () => void) => void): void {
    this.endPingLoop();
    this.currentPing = ping;
    this.interval = interval;
    this.lastPongAt = Date.now();

    if (!this.worker) {
      this.worker = this.createWorker();
    }

    if (this.worker) {
      this.worker.addEventListener('message', this.boundHandleMessage);
      this.worker.postMessage({ type: 'start', interval } as WorkerMessage);
      return;
    }

    this.fallbackTimer = setInterval(() => this.tick(), interval);
  }

  public endPingLoop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' } as WorkerMessage);
      this.worker.removeEventListener('message', this.boundHandleMessage);
    }
    if (this.fallbackTimer !== null) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.lastPingPending = false;
    this.currentPing = null;
    this.missedPongs = 0;
    this.lastPongAt = null;
    this.lastPingSentAt = null;
  }

  private createWorker(): Worker | null {
    if (typeof Worker === 'undefined') {
      return null;
    }
    try {
      // See .github/instructions/sockatrice-transport.instructions.md#keep-alive-worker.
      return new Worker(
        new URL('./keepAliveWorker.js', import.meta.url),
        { type: 'module' },
      );
    } catch {
      return null;
    }
  }

  private handleMessage(event: MessageEvent<TickMessage>): void {
    if (!event || !event.data || event.data.type !== 'tick') {
      return;
    }
    this.tick();
  }

  private tick(): void {
    if (this.lastPingPending) {
      const pingAgeMs = this.lastPingSentAt === null ? null : Date.now() - this.lastPingSentAt;
      if (pingAgeMs === null || pingAgeMs < this.interval * MISS_MIN_AGE_FACTOR) {
        return;
      }
      this.missedPongs += 1;
      if (this.missedPongs >= DEGRADED_AFTER_MISSES) {
        const silentForMs = this.lastPongAt === null ? 0 : Date.now() - this.lastPongAt;
        this.onHealthChange(this.missedPongs, silentForMs);
      }
    }

    if (!this.isOpen()) {
      this.endPingLoop();
      return;
    }

    const ping = this.currentPing;
    if (!ping) {
      return;
    }
    this.lastPingPending = true;
    this.lastPingSentAt = Date.now();
    ping(() => {
      const wasDegraded = this.missedPongs >= DEGRADED_AFTER_MISSES;
      this.lastPingPending = false;
      this.missedPongs = 0;
      this.lastPongAt = Date.now();
      if (wasDegraded) {
        this.onHealthChange(0, 0);
      }
    });
  }
}
