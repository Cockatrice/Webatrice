import type { TickMessage, WorkerMessage } from './keepAliveWorkerHandler';

export class KeepAliveService {
  private isOpen: () => boolean;
  private onDisconnected: () => void;

  private worker: Worker | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingPending = false;
  private currentPing: ((onPong: () => void) => void) | null = null;
  private boundHandleMessage: (event: MessageEvent) => void;

  constructor(isOpen: () => boolean, onDisconnected: () => void) {
    this.isOpen = isOpen;
    this.onDisconnected = onDisconnected;
    this.boundHandleMessage = this.handleMessage.bind(this);
  }

  public startPingLoop(interval: number, ping: (onPong: () => void) => void): void {
    this.endPingLoop();
    this.currentPing = ping;

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
      this.onDisconnected();
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
    ping(() => {
      this.lastPingPending = false;
    });
  }
}
