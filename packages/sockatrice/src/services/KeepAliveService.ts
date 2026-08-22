import type { TickMessage, WorkerMessage } from './keepAliveWorkerHandler';

// The keepalive NEVER closes the connection. Without credential retention a
// self-inflicted disconnect is strictly destructive (a lagged server that
// recovers resumes the session intact; a forced close guarantees a re-login),
// so missed pongs only degrade reported health. Genuine death surfaces via
// the socket's own close/error events — and pinging every interval into a
// dead connection is what forces TCP to discover it.
// Report degraded after ~2 intervals of silence (~10s at the 5s default).
const DEGRADED_AFTER_MISSES = 2;
// A tick only counts as a miss if the pending ping is at least this fraction
// of an interval old. Ticks queue up behind a stalled main thread and then
// drain back-to-back milliseconds apart; without this guard the tick right
// after a ping is armed would declare it missed 1-2ms after it was sent
// (observed in field captures).
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
  private reportedDegraded = false;

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
    this.reportedDegraded = false;
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
      if (pingAgeMs !== null && pingAgeMs >= this.interval * MISS_MIN_AGE_FACTOR) {
        this.missedPongs += 1;
        if (this.missedPongs >= DEGRADED_AFTER_MISSES) {
          const silentForMs = this.lastPongAt === null ? 0 : Date.now() - this.lastPongAt;
          this.reportedDegraded = true;
          this.onHealthChange(this.missedPongs, silentForMs);
        }
      }
      // Otherwise: burst-drained tick — the pending ping is younger than an
      // interval, so it never had a fair chance to be answered. Not a miss.
    } else {
      this.missedPongs = 0;
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
      this.lastPingPending = false;
      this.missedPongs = 0;
      this.lastPongAt = Date.now();
      if (this.reportedDegraded) {
        this.reportedDegraded = false;
        this.onHealthChange(0, 0);
      }
    });
  }
}