import { StatusEnum } from '../types/StatusEnum';
import { KeepAliveService } from './KeepAliveService';
import type { ConnectTarget } from '../types/WebClientConfig';
import { buildWebSocketUrl } from '../utils/buildWebSocketUrl';
import { terminateSocket } from '../utils/terminateSocket';

export interface ReconnectConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface WebSocketServiceConfig {
  keepAliveFn: (pingReceived: () => void) => void;
  keepalive: number;
  onStatusChange: (status: StatusEnum, description: string) => void;
  onConnectionFailed: () => void;
  onConnectionUnreachable?: () => void;
  onMessage: (message: MessageEvent) => void;
  /** Keepalive health: missedPongs > 0 while pings go unanswered, 0 on recovery.
   *  The keepalive never closes the connection — see KeepAliveService. */
  onConnectionHealth?: (missedPongs: number, silentForMs: number) => void;
  /** Opt-in automatic reconnect on unexpected socket close. */
  reconnect?: ReconnectConfig;
}

export class WebSocketService {
  private socket: WebSocket | null = null;

  private config: WebSocketServiceConfig;
  private keepAliveService: KeepAliveService;
  private hasReportedError = false;

  private keepalive: number;

  private lastTarget: ConnectTarget | null = null;

  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * True after first successful `onopen`; gates reconnect.
   * See .github/instructions/sockatrice-transport.instructions.md#websocket-lifecycle.
   */
  private hasEverOpened = false;

  constructor(config: WebSocketServiceConfig) {
    this.config = config;
    this.keepalive = config.keepalive;

    this.keepAliveService = new KeepAliveService(
      () => this.checkReadyState(WebSocket.OPEN),
      (missedPongs, silentForMs) => {
        this.config.onConnectionHealth?.(missedPongs, silentForMs);
      },
    );
  }

  public connect(target: ConnectTarget): void {
    this.clearReconnectTimer();
    this.closeActiveSocket(true);

    this.lastTarget = target;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.hasEverOpened = false;
    this.keepalive = this.config.keepalive;

    const { host, port } = target;
    this.socket = this.createWebSocket(buildWebSocketUrl(host, port));
  }

  public disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.closeActiveSocket(false);
  }

  public checkReadyState(state: number): boolean {
    return this.socket?.readyState === state;
  }

  public send(message: Uint8Array): void {
    if (!this.socket) {
      return;
    }
    if (this.socket.readyState !== WebSocket.OPEN) {
      // See .github/instructions/sockatrice-transport.instructions.md#send-semantics.
      console.warn('[WebSocketService] send() skipped: socket not OPEN', this.socket.readyState);
      return;
    }
    this.socket.send(message as BufferSource);
  }

  private createWebSocket(url: string): WebSocket {
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';

    // Raw close (not WebSocketService.terminate) on purpose: this fires only when
    // the socket never opened within `keepalive` ms — a genuinely stuck/refused
    // connect that established nothing to strand — and its onclose is what drives
    // the DISCONNECTED / reconnect path. Deferring the close (terminate) would
    // wait for an onopen that never comes and hang reconnect.
    const connectionTimer = setTimeout(() => socket.close(), this.keepalive);
    const clearConnectionTimer = (): void => clearTimeout(connectionTimer);

    socket.onopen = () => {
      this.hasEverOpened = true;
      clearConnectionTimer();
      this.hasReportedError = false;
      this.reconnectAttempts = 0;
      this.config.onStatusChange(StatusEnum.CONNECTED, 'Connected');

      this.keepAliveService.startPingLoop(this.keepalive, (pingReceived: () => void) => {
        this.config.keepAliveFn(pingReceived);
      });
    };

    socket.onclose = () => {
      clearConnectionTimer();
      this.keepAliveService.endPingLoop();

      if (this.shouldAttemptReconnect()) {
        this.scheduleReconnect();
        return;
      }

      // Current socket closed without ever opening — never reached the server.
      // Identity-gated so a retired socket's late onclose can't fire this.
      if (this.socket === socket && !this.hasEverOpened) {
        this.config.onConnectionUnreachable?.();
      }

      // @critical onerror + onclose both fire on failed connects; don't overwrite the richer error status.
      // See .github/instructions/sockatrice-transport.instructions.md#websocket-lifecycle.
      if (!this.hasReportedError) {
        this.config.onStatusChange(StatusEnum.DISCONNECTED, 'Connection Closed');
      }
      this.hasReportedError = false;
    };

    socket.onerror = () => {
      clearConnectionTimer();
      this.hasReportedError = true;
      this.config.onStatusChange(StatusEnum.DISCONNECTED, 'Connection Failed');
      this.config.onConnectionFailed();
    };

    socket.onmessage = (event: MessageEvent) => {
      this.config.onMessage(event);
    };

    return socket;
  }

  private shouldAttemptReconnect(): boolean {
    // Gates: see .github/instructions/sockatrice-transport.instructions.md#websocket-lifecycle.
    if (this.intentionalDisconnect) {
      return false;
    }

    if (this.hasReportedError) {
      return false;
    }
    if (!this.hasEverOpened) {
      return false;
    }
    const cfg = this.config.reconnect;
    if (!cfg || cfg.maxAttempts <= 0) {
      return false;
    }
    return this.reconnectAttempts < cfg.maxAttempts;
  }

  private scheduleReconnect(): void {
    const cfg = this.config.reconnect!;
    const attempt = this.reconnectAttempts;
    const delay = Math.min(cfg.baseDelayMs * Math.pow(2, attempt), cfg.maxDelayMs);
    this.reconnectAttempts += 1;

    this.config.onStatusChange(
      StatusEnum.RECONNECTING,
      `Reconnecting (attempt ${this.reconnectAttempts}/${cfg.maxAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.intentionalDisconnect || !this.lastTarget) {
        return;
      }
      const { host, port } = this.lastTarget;
      this.socket = this.createWebSocket(buildWebSocketUrl(host, port));
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeActiveSocket(retiringForReconnect: boolean): void {
    if (!this.socket) {
      return;
    }
    const socket = this.socket;
    this.socket = null;

    // Detach onmessage always — late buffered frames from a socket we no longer
    // own must not re-enter after teardown.
    socket.onmessage = null;

    // A still-CONNECTING socket is retired via terminateSocket (defers a clean
    // close to onopen instead of aborting into a stranded half-open). But that
    // deferred open→close would otherwise fire this orphan's onopen (CONNECTED +
    // ping loop) and onclose (DISCONNECTED / reconnect) — so silence its lifecycle
    // handlers first. terminateSocket re-arms onopen to the clean close.
    if (socket.readyState === WebSocket.CONNECTING) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
    } else if (retiringForReconnect) {
      // OPEN socket cycled out by a fresh connect(): detach its lifecycle handlers
      // so a late onclose/onerror can't tear down the replacement's keepalive,
      // emit DISCONNECTED, or corrupt hasReportedError against the live replacement.
      // Not done on an intentional disconnect(), whose onclose must still emit
      // DISCONNECTED. terminateSocket owns close timing only.
      socket.onclose = null;
      socket.onerror = null;
    }

    terminateSocket(socket);
  }

}
