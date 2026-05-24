import { StatusEnum } from '../types/StatusEnum';
import { KeepAliveService } from './KeepAliveService';
import type { ConnectTarget } from '../types/WebClientConfig';
import { buildWebSocketUrl } from '../utils/buildWebSocketUrl';

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
  onMessage: (message: MessageEvent) => void;
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
  private lastProtocol: string | null = null;

  private intentionalDisconnect = false;
  /**
   * True while `connect()` cycles a prior socket out.
   * See .github/instructions/sockatrice-transport.instructions.md#websocket-lifecycle.
   */
  private retiringForReconnect = false;
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
      () => {
        this.disconnect();
        this.config.onStatusChange(StatusEnum.DISCONNECTED, 'Connection timeout');
      },
    );
  }

  public connect(target: ConnectTarget, protocol: string = 'wss'): void {
    if (window.location.hostname === 'localhost') {
      protocol = 'ws';
    }

    // Retire prior socket; retiringForReconnect suppresses orphan reconnect+DISCONNECTED.
    // See .github/instructions/sockatrice-transport.instructions.md#websocket-lifecycle.
    this.retiringForReconnect = true;
    this.clearReconnectTimer();
    this.closeActiveSocket();
    this.retiringForReconnect = false;

    this.lastTarget = target;
    this.lastProtocol = protocol;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.hasEverOpened = false;
    this.keepalive = this.config.keepalive;

    const { host, port } = target;
    this.socket = this.createWebSocket(buildWebSocketUrl(protocol as 'ws' | 'wss', host, port));
  }

  public disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.closeActiveSocket();
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

      // Orphan socket retired by fresh connect(); skip status emission.
      // See .github/instructions/sockatrice-transport.instructions.md#websocket-lifecycle.
      if (this.retiringForReconnect) {
        this.hasReportedError = false;
        return;
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
    if (this.retiringForReconnect) {
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
      if (this.intentionalDisconnect || !this.lastTarget || !this.lastProtocol) {
        return;
      }
      const { host, port } = this.lastTarget;
      this.socket = this.createWebSocket(
        buildWebSocketUrl(this.lastProtocol as 'ws' | 'wss', host, port),
      );
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeActiveSocket(): void {
    if (this.socket) {
      // Detach onmessage only; keep onopen/onclose/onerror.
      // See .github/instructions/sockatrice-transport.instructions.md#websocket-lifecycle.
      this.socket.onmessage = null;
      this.socket.close();
      this.socket = null;
    }
  }

}
