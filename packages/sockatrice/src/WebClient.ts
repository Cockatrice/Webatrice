import { fromBinary, getExtension, hasExtension, isFieldSet } from '@bufbuild/protobuf';

import {
  Event_ServerIdentification_ext,
  GameEventContainerSchema,
  ServerMessageSchema,
  ServerMessage_MessageType,
  type GameEventContainer,
  type ServerInfo_Game,
} from './generated';

import {
  AdminCommands,
  AuthenticationCommands,
  DeveloperCommands,
  GameCommands,
  ModeratorCommands,
  RoomCommands,
  SessionCommands,
} from './commands';
import { GameEvents } from './events/game';
import { RoomEvents } from './events/room';
import { SessionEvents } from './events/session';
import type { ClientConfig } from './types/ClientConfig';
import type { ClientOptions } from './types/ClientOptions';
import type { ConnectTarget } from './types/WebClientConfig';
import type { IWebClientResponse } from './types/WebClientResponse';
import type { ReplayEventOptions } from './types/WebSocketConfig';
import { StatusEnum } from './types/StatusEnum';
import { DEFAULT_COMMAND_TIMEOUT_MS, ProtobufService } from './services/ProtobufService';
import { WebSocketService } from './services/WebSocketService';
import { buildWebSocketUrl } from './utils/buildWebSocketUrl';
import { terminateSocket } from './utils/terminateSocket';
import { passwordSaltSupported } from './utils/passwordHasher';
import { PROTOCOL_VERSION } from './protocol';

export class WebClient {
  private static _instance: WebClient | null = null;

  static get instance(): WebClient {
    if (!WebClient._instance) {
      throw new Error(
        'WebClient has not been initialized. Instantiate it via `new WebClient()` before accessing `WebClient.instance`.'
      );
    }
    return WebClient._instance;
  }

  // Sanctioned reset path: tests, SPA hot-reload, explicit logout.
  // See .github/instructions/sockatrice-transport.instructions.md#webclient-lifecycle.
  public static dispose(): void {
    if (!WebClient._instance || WebClient._instance.disposed) {
      return;
    }
    const client = WebClient._instance;
    client.disposed = true;
    try {
      client.socket.dispose();
      client.retireTestSocket();
      client.protobuf.resetCommands();
      client.status = StatusEnum.DISCONNECTED;
      client.response.session.updateStatus(StatusEnum.DISCONNECTED, 'Connection Closed');
    } finally {
      WebClient._instance = null;
    }
  }

  protobuf: ProtobufService;
  socket: WebSocketService;
  status: StatusEnum;
  serverSupportsPasswordHash = false;
  private testSocket: WebSocket | null = null;
  private clearTestTimer: (() => void) | undefined;
  private disposed = false;
  private resetting = false;

  request = {
    authentication: AuthenticationCommands,
    session: SessionCommands,
    rooms: RoomCommands,
    game: GameCommands,
    admin: AdminCommands,
    moderator: ModeratorCommands,
    developer: DeveloperCommands,
  }

  constructor(
    public response: IWebClientResponse,
    public clientConfig: ClientConfig,
    public clientOptions: ClientOptions,
  ) {
    if (WebClient._instance) {
      throw new Error('WebClient is a singleton and has already been initialized.');
    }

    this.socket = new WebSocketService({
      keepAliveFn: SessionCommands.ping,
      keepalive: clientOptions.keepalive,
      onStatusChange: (status, description) => {
        if (this.disposed) {
          return;
        }
        this.updateStatus(status);
        this.response.session.updateStatus(status, description);
      },
      onConnectionFailed: () => {
        this.response.session.connectionFailed();
      },
      onConnectionUnreachable: () => {
        this.response.session.connectionUnreachable();
      },
      onConnectionHealth: (missedPongs, silentForMs) => {
        this.response.session.updateConnectionHealth?.(missedPongs, silentForMs);
      },
      onMessage: (message) => {
        this.protobuf.handleMessageEvent(message);
      },
      reconnect: {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      },
    });

    this.protobuf = new ProtobufService(
      {
        send: (data) => this.socket.send(data),
        isOpen: () => !this.disposed && !this.resetting
          && this.status !== StatusEnum.DISCONNECTED && this.status !== StatusEnum.RECONNECTING
          && this.socket.checkReadyState(WebSocket.OPEN),
      },
      { game: GameEvents, room: RoomEvents, session: SessionEvents },
      DEFAULT_COMMAND_TIMEOUT_MS,
      (stats, samplesMs) => {
        this.response.session.updateLatencyStats?.(stats, samplesMs);
      },
    );

    WebClient._instance = this;

    this.response.session.initialized();
  }

  public connect(target: ConnectTarget): void {
    if (this.disposed || this.resetting) {
      return;
    }
    this.resetting = true;
    try {
      this.protobuf.resetCommands();
      if (!this.disposed) {
        this.response.session.connectionAttempted();
        this.socket.connect(target);
      }
    } finally {
      this.resetting = false;
    }
  }

  public testConnect(target: ConnectTarget): void {
    if (this.disposed) {
      return;
    }
    // Retire any in-flight test socket via the safe terminate (a superseded probe
    // is usually still CONNECTING, and close() on a CONNECTING socket strands a
    // half-open upstream against Servatrice's per-IP cap).
    // See .github/instructions/sockatrice-transport.instructions.md#webclient-lifecycle.
    this.retireTestSocket();

    const socket = new WebSocket(buildWebSocketUrl(target.host, target.port));
    socket.binaryType = 'arraybuffer';
    this.testSocket = socket;

    // Wait for Event_ServerIdentification; resolve bitmask to a boolean.
    // See .github/instructions/sockatrice-transport.instructions.md#webclient-lifecycle.
    let resolved = false;
    const resolve = (ok: boolean, supportsHashedPassword = false, unreachable = false): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeout);
      // Suppress dispatches from a superseded socket — a newer test has
      // already taken over and we'd race a stale result into its pending-ref.
      if (this.testSocket === socket) {
        if (ok) {
          this.response.session.testConnectionSuccessful(supportsHashedPassword);
        } else {
          this.response.session.testConnectionFailed();
          if (unreachable) {
            this.response.session.connectionUnreachable();
          }
        }
        this.testSocket = null;
      }
      terminateSocket(socket);
    };

    const resolveUnreachable = (): void => resolve(false, false, true);

    const timeout = setTimeout(resolveUnreachable, this.clientOptions.keepalive);
    this.clearTestTimer = () => clearTimeout(timeout);

    socket.onmessage = (event: MessageEvent) => {
      try {
        const msg = fromBinary(ServerMessageSchema, new Uint8Array(event.data));
        if (msg.messageType !== ServerMessage_MessageType.SESSION_EVENT) {
          return;
        }
        const sessionEvent = msg.sessionEvent;
        if (!sessionEvent || !hasExtension(sessionEvent, Event_ServerIdentification_ext)) {
          return;
        }
        const ident = getExtension(sessionEvent, Event_ServerIdentification_ext);
        if (ident.protocolVersion !== this.protocolVersion) {
          resolve(false);
          return;
        }
        resolve(true, passwordSaltSupported(ident.serverOptions));
      } catch {
        resolve(false);
      }
    };

    socket.onerror = resolveUnreachable;
    socket.onclose = resolveUnreachable;
  }

  private retireTestSocket(): void {
    this.clearTestTimer?.();
    this.clearTestTimer = undefined;
    const socket = this.testSocket;
    this.testSocket = null;
    if (socket) {
      socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
      terminateSocket(socket);
    }
  }

  public disconnect(): void {
    this.socket.disconnect();
  }

  public updateStatus(status: StatusEnum): void {
    this.status = status;

    if (status === StatusEnum.DISCONNECTED || status === StatusEnum.RECONNECTING) {
      this.protobuf.resetCommands();
    }
  }

  public replayGameEventContainer(container: GameEventContainer, gameId: number, options?: ReplayEventOptions): void {
    if (isFieldSet(container, GameEventContainerSchema.field.secondsElapsed)) {
      this.response.game.replayGameTimeSynced?.(gameId, container.secondsElapsed);
    }
    this.protobuf.replayGameEventContainer(container, gameId, options);
  }

  public loadReplayGame(gameId: number, gameInfo: ServerInfo_Game): void {
    this.response.game.replayGameLoaded?.(gameId, gameInfo);
  }

  public unloadReplayGame(gameId: number): void {
    this.response.game.replayGameUnloaded?.(gameId);
  }

  public get isReconnecting(): boolean {
    return this.status === StatusEnum.RECONNECTING;
  }

  public get protocolVersion(): number {
    return PROTOCOL_VERSION;
  }
}
