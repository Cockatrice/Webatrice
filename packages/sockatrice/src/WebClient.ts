import { fromBinary, getExtension, hasExtension } from '@bufbuild/protobuf';

import {
  Event_ServerIdentification_ext,
  ServerMessageSchema,
  ServerMessage_MessageType,
} from './generated';

import {
  AdminCommands,
  AuthenticationCommands,
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
import { StatusEnum } from './types/StatusEnum';
import { ProtobufService } from './services/ProtobufService';
import { WebSocketService } from './services/WebSocketService';
import { buildWebSocketUrl } from './utils/buildWebSocketUrl';
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

  // Sanctioned reset path: tests, SPA hot-reload, explicit logout. See .github/instructions/sockatrice-transport.instructions.md#webclient-lifecycle.
  public static dispose(): void {
    if (!WebClient._instance) {
      return;
    }
    WebClient._instance.disconnect();
    WebClient._instance = null;
  }

  protobuf: ProtobufService;
  socket: WebSocketService;
  status: StatusEnum;
  private testSocket: WebSocket | null = null;

  request = {
    authentication: AuthenticationCommands,
    session: SessionCommands,
    rooms: RoomCommands,
    game: GameCommands,
    admin: AdminCommands,
    moderator: ModeratorCommands,
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
        this.response.session.updateStatus(status, description);
        this.updateStatus(status);
      },
      onConnectionFailed: () => {
        this.response.session.connectionFailed();
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
        isOpen: () => this.socket.checkReadyState(WebSocket.OPEN),
      },
      { game: GameEvents, room: RoomEvents, session: SessionEvents },
    );

    WebClient._instance = this;

    this.response.session.initialized();
  }

  public connect(target: ConnectTarget): void {
    this.response.session.connectionAttempted();
    this.socket.connect(target);
  }

  public testConnect(target: ConnectTarget): void {
    // Close any in-flight test socket eagerly. See .github/instructions/sockatrice-transport.instructions.md#webclient-lifecycle.
    if (this.testSocket) {
      this.testSocket.close();
      this.testSocket = null;
    }

    const protocol = window.location.hostname === 'localhost' ? 'ws' : 'wss';
    const socket = new WebSocket(buildWebSocketUrl(protocol, target.host, target.port));
    socket.binaryType = 'arraybuffer';
    this.testSocket = socket;

    // Wait for Event_ServerIdentification; resolve bitmask to a boolean. See .github/instructions/sockatrice-transport.instructions.md#webclient-lifecycle.
    let resolved = false;
    const resolve = (ok: boolean, supportsHashedPassword = false): void => {
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
        }
        this.testSocket = null;
      }
      socket.close();
    };

    const timeout = setTimeout(() => resolve(false), this.clientOptions.keepalive);

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

    socket.onerror = () => resolve(false);
    socket.onclose = () => resolve(false);
  }

  public disconnect(): void {
    this.socket.disconnect();
  }

  public updateStatus(status: StatusEnum): void {
    this.status = status;

    if (status === StatusEnum.DISCONNECTED) {
      this.protobuf.resetCommands();
    }
  }

  public get isReconnecting(): boolean {
    return this.status === StatusEnum.RECONNECTING;
  }

  public get protocolVersion(): number {
    return PROTOCOL_VERSION;
  }
}
