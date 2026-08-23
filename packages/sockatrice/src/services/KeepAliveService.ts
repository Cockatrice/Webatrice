import type { TickMessage, WorkerMessage } from './keepAliveWorkerHandler';

// @critical The keepalive NEVER closes the connection — missed pongs only
// degrade reported health. Rationale (no credential retention, TCP discovery)
// in .github/instructions/sockatrice-transport.instructions.md#keep-alive-worker.

// Report degraded after ~2 intervals of silence (~10s at the 5s default).
const DEGRADED_AFTER_MISSES = 2;
// A tick counts as a miss only if the pending ping is at least this fraction of
// an interval old (guards against burst-drained ticks — see tick() below).
const MISS_MIN_AGE_FACTOR = 0.9;

/** missedPongs = 0 signals recovery; silentForMs = time since the last pong. */
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
  // Date.now()-based: the miss decision must share a clock with the tick
  // scheduler (fake timers in tests fake Date; performance.now is not
  // reliably faked). Wall-clock jumps at worst cost one spurious miss.
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
    // Healthy baseline: silence is measured from loop start until the first pong.
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
      // Burst-drained tick: ticks queue behind a stalled main thread and drain
      // back-to-back. A pending ping younger than ~an interval never had a fair
      // chance to be answered — don't count it as a miss, and don't pile on
      // another ping (which would flood the server on drain).
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
      // Recovery is reported exactly when we were degraded — derived from the
      // pre-reset miss count, so no separate "reported" flag is needed.
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
