// Integration test setup for Sockatrice. Installs a mock WebSocket
// constructor, wires up fake timers, and resets the WebClient singleton
// between tests so real event handlers and the protobuf pipeline run against
// a clean slate each time.
//
// Only `globalThis.WebSocket` is mocked. Everything downstream of it
// (ProtobufService, event registries, status transitions) runs as real code.
//
// This module is side-effect-free on import. Consumers who want the
// `beforeEach`/`afterEach` lifecycle hooks plus the global-WebSocket
// installation must import from `./setup-hooks` (typically as a vitest
// setupFile).
//
// Diff from webclient's setup.ts: drops @app/store / @app/api / @app/types /
// fake-indexeddb / jest-dom. Webclient's request/response factories that wire
// the WebClient into Redux are replaced with vi.fn-based stubs from
// ./web-client-stubs. Tests assert against the stubs instead of Redux state.

import { create } from '@bufbuild/protobuf';
import { vi } from 'vitest';

import * as Data from '../generated';
import { PROTOCOL_VERSION, WebClient, setPendingOptions } from '..';
import { createWorkerHandler } from '../services/keepAliveWorkerHandler';
import { WebsocketTypes } from '../types';

export { PROTOCOL_VERSION };
export const CLIENT_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'webatrice',
  clientver: 'webclient-1.0 (test)',
  clientfeatures: [
    'client_id',
    'client_ver',
    'feature_set',
    'room_chat_history',
    'client_warnings',
    'forgot_password',
    'idle_client',
    'mod_log_lookup',
    'user_ban_history',
    'websocket',
    '2.7.0_min_version',
    '2.8.0_min_version',
  ],
};
export const CLIENT_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: true,
  keepalive: 5000,
};

import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from './protobuf-builders';
import { findLastSessionCommand } from './command-capture';
import {
  createMockWebClientResponse,
  MockWebClientResponse,
} from './web-client-stubs';

export { setPendingOptions };
export type { MockWebClientResponse };

export interface MockWebSocketInstance {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  binaryType: BinaryType;
  url: string;
  onopen: ((ev?: Event) => void) | null;
  onclose: ((ev?: CloseEvent) => void) | null;
  onerror: ((ev?: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
}

export interface MockWorkerInstance {
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}

export interface MockWorkerArgs {
  url: unknown;
  options: unknown;
}

// Module-private state. Reset by `_resetAll()` between tests when the
// integration-hooks setupFile is in use; otherwise consumers manage lifecycle
// themselves.
let currentMockInstance: MockWebSocketInstance | null = null;
let currentMockWorker: MockWorkerInstance | null = null;
let currentWorkerArgs: MockWorkerArgs | null = null;
let currentMockResponse: MockWebClientResponse | null = null;

export function getMockWebSocket(): MockWebSocketInstance {
  if (!currentMockInstance) {
    throw new Error(
      'No mock WebSocket has been constructed yet. Call webClient.connect(...) before reading the mock instance.'
    );
  }
  return currentMockInstance;
}

export function getMockWorker(): MockWorkerInstance {
  if (!currentMockWorker) {
    throw new Error(
      'No mock Worker has been constructed yet. Start the keep-alive ping loop before reading the mock instance.'
    );
  }
  return currentMockWorker;
}

export function getMockWorkerArgs(): MockWorkerArgs {
  if (!currentWorkerArgs) {
    throw new Error('No mock Worker has been constructed yet.');
  }
  return currentWorkerArgs;
}

export function getMockResponse(): MockWebClientResponse {
  if (!currentMockResponse) {
    throw new Error('No mock response has been constructed for this test.');
  }
  return currentMockResponse;
}

function makeMockInstance(url: string): MockWebSocketInstance {
  return {
    send: vi.fn(),
    close: vi.fn(function close(this: MockWebSocketInstance) {
      // CLOSED
      this.readyState = 3;
      this.onclose?.({ code: 1000, reason: '', wasClean: true } as CloseEvent);
    }),
    // CONNECTING
    readyState: 0,
    binaryType: 'arraybuffer',
    url,
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };
}

/**
 * Install a Vitest-mocked `WebSocket` constructor on the global object so
 * that `new WebSocket(url)` returns a recordable instance. Called at module
 * load time by `./setup-hooks`; integration tests pick up the singleton via
 * `getMockWebSocket()` after the WebClient connects.
 */
export function installMockWebSocket(): void {
  const MockWS = vi.fn(function MockWebSocket(url: string) {
    currentMockInstance = makeMockInstance(url);
    return currentMockInstance;
  }) as unknown as typeof WebSocket;
  (MockWS as unknown as { CONNECTING: number }).CONNECTING = 0;
  (MockWS as unknown as { OPEN: number }).OPEN = 1;
  (MockWS as unknown as { CLOSING: number }).CLOSING = 2;
  (MockWS as unknown as { CLOSED: number }).CLOSED = 3;
  globalThis.WebSocket = MockWS;
}

function makeMockWorkerInstance(): MockWorkerInstance {
  const listeners = new Set<(event: MessageEvent) => void>();
  const handler = createWorkerHandler((msg) => {
    const event = { data: msg } as MessageEvent;
    listeners.forEach((listener) => listener(event));
  });
  return {
    postMessage: vi.fn((msg: unknown) => {
      handler({ data: msg } as MessageEvent);
    }),
    addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') {
        listeners.delete(listener);
      }
    }),
    terminate: vi.fn(() => {
      listeners.clear();
    }),
  };
}

let originalWorker: typeof Worker | undefined;

export function installMockWorker(): void {
  if (originalWorker === undefined) {
    originalWorker = globalThis.Worker;
  }
  const MockWorker = vi.fn(function MockWorker(url: unknown, options: unknown) {
    currentWorkerArgs = { url, options };
    currentMockWorker = makeMockWorkerInstance();
    return currentMockWorker;
  }) as unknown as typeof Worker;
  globalThis.Worker = MockWorker;
}

export function uninstallMockWorker(): void {
  if (originalWorker !== undefined) {
    globalThis.Worker = originalWorker;
  } else {
    delete (globalThis as { Worker?: typeof Worker }).Worker;
  }
  currentMockWorker = null;
  currentWorkerArgs = null;
}

export function openMockWebSocket(): void {
  const mock = getMockWebSocket();
  // OPEN
  mock.readyState = 1;
  mock.onopen?.(new Event('open'));
}

export function getWebClient(): WebClient {
  return WebClient.instance;
}

/**
 * Build a fresh pair of mock request/response stubs and instantiate a new
 * WebClient singleton against them. Idempotent; safe to call from a
 * `beforeEach` hook.
 */
export function createWebClientForTest(): WebClient {
  currentMockResponse = createMockWebClientResponse();
  return new WebClient(currentMockResponse, CLIENT_CONFIG, CLIENT_OPTIONS);
}

/**
 * Tear down all module-private state. Closes any still-open mock socket and
 * nulls the WebClient singleton so the next `createWebClientForTest()`
 * starts from scratch. Invoked from the integration-hooks `afterEach`.
 */
export function _resetAll(): void {
  const client = WebClient.instance;

  if (currentMockInstance && currentMockInstance.readyState === 1) {
    client.disconnect();
  }

  client.protobuf.resetCommands();
  client.status = WebsocketTypes.StatusEnum.DISCONNECTED;

  if (currentMockInstance) {
    currentMockInstance.onopen = null;
    currentMockInstance.onclose = null;
    currentMockInstance.onerror = null;
    currentMockInstance.onmessage = null;
    currentMockInstance = null;
  }

  currentMockWorker = null;
  currentWorkerArgs = null;
  currentMockResponse = null;

  (WebClient as unknown as { _instance: WebClient | null })._instance = null;
}

// ── Shared connect helpers ──────────────────────────────────────────────────

const DEFAULT_LOGIN_OPTIONS: WebsocketTypes.WebSocketConnectOptions = {
  reason: WebsocketTypes.WebSocketConnectReason.LOGIN,
  host: 'localhost',
  port: '4748',
  userName: 'alice',
  password: 'secret',
};

export function connectRaw(
  overrides: Partial<WebsocketTypes.WebSocketConnectOptions> = {}
): void {
  const opts = { ...DEFAULT_LOGIN_OPTIONS, ...overrides };
  setPendingOptions(opts as WebsocketTypes.WebSocketConnectOptions);
  getWebClient().connect({ host: opts.host, port: opts.port });
  openMockWebSocket();
}

export function connectAndHandshake(
  overrides: Partial<WebsocketTypes.WebSocketConnectOptions> = {}
): void {
  connectRaw(overrides);
  deliverMessage(buildSessionEventMessage(
    Data.Event_ServerIdentification_ext,
    create(Data.Event_ServerIdentificationSchema, {
      serverName: 'TestServer',
      serverVersion: '2.8.0',
      protocolVersion: PROTOCOL_VERSION,
    })
  ));
}

export function connectAndHandshakeWithSalt(
  overrides: Partial<WebsocketTypes.WebSocketConnectOptions> = {}
): void {
  connectRaw(overrides);
  deliverMessage(buildSessionEventMessage(
    Data.Event_ServerIdentification_ext,
    create(Data.Event_ServerIdentificationSchema, {
      serverName: 'TestServer',
      serverVersion: '2.8.0',
      protocolVersion: PROTOCOL_VERSION,
      serverOptions: Data.Event_ServerIdentification_ServerOptions.SupportsPasswordHash,
    })
  ));
}

export function connectAndLogin(userName: string = 'alice'): void {
  connectAndHandshake({ userName });

  const login = findLastSessionCommand(Data.Command_Login_ext);
  const userInfo = create(Data.ServerInfo_UserSchema, {
    name: userName,
    userLevel: Data.ServerInfo_User_UserLevelFlag.IsRegistered,
  });
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: login.cmdId,
    responseCode: Data.Response_ResponseCode.RespOk,
    ext: Data.Response_Login_ext,
    value: create(Data.Response_LoginSchema, {
      userInfo,
      buddyList: [],
      ignoreList: [],
    }),
  })));
}
