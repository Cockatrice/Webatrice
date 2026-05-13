import '@testing-library/jest-dom/vitest';
import '../../../src/polyfills';
// @critical fake-indexeddb must precede any module that opens a Dexie database.
import 'fake-indexeddb/auto';

import { create } from '@bufbuild/protobuf';
import { combineReducers } from '@reduxjs/toolkit';
import { afterEach, beforeEach, vi } from 'vitest';

import { rootReducerMap } from '@app/store';
import { attachResponseHandlers, createStore, games, rooms, server } from 'datatrice';

// Integration tests run in vitest (node) with a mocked WebSocket; they don't
// mount <DatatriceProvider>, so they can't get a store from React context.
// This module owns the integration store directly. Specs import it from here
// — NOT from `@app/store`, which no longer exports a singleton post-v0.5.0
// migration.
export const store = createStore({ reducer: combineReducers(rootReducerMap) });
import {
  PROTOCOL_VERSION,
  WebClient,
  setPendingOptions,
} from 'sockatrice';
import { WebsocketTypes } from 'sockatrice/types';
import {
  Command_Login_ext,
  Event_ServerIdentificationSchema,
  Event_ServerIdentification_ServerOptions,
  Event_ServerIdentification_ext,
  Response_Login_ext,
  Response_LoginSchema,
  Response_ResponseCode,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
} from 'sockatrice/generated';
import { CLIENT_CONFIG, CLIENT_OPTIONS } from '../../../src/clientConfig';

export { PROTOCOL_VERSION };

import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from './protobuf-builders';
import { findLastSessionCommand } from './command-capture';

export { setPendingOptions };

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

let currentMockInstance: MockWebSocketInstance | null = null;

export function getMockWebSocket(): MockWebSocketInstance {
  if (!currentMockInstance) {
    throw new Error(
      'No mock WebSocket has been constructed yet. Call webClient.connect(...) before reading the mock instance.'
    );
  }
  return currentMockInstance;
}

function makeMockInstance(url: string): MockWebSocketInstance {
  return {
    send: vi.fn(),
    close: vi.fn(function close(this: MockWebSocketInstance) {
      this.readyState = 3; // CLOSED
      this.onclose?.({ code: 1000, reason: '', wasClean: true } as CloseEvent);
    }),
    readyState: 0, // CONNECTING
    binaryType: 'arraybuffer',
    url,
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };
}

function installMockWebSocket(): void {
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

export function openMockWebSocket(): void {
  const mock = getMockWebSocket();
  mock.readyState = 1; // OPEN
  mock.onopen?.(new Event('open'));
}

export function getWebClient(): WebClient {
  return WebClient.instance;
}

function resetAll(): void {
  const client = WebClient.instance;

  if (currentMockInstance && currentMockInstance.readyState === 1) {
    client.disconnect();
  }

  client.protobuf.resetCommands();
  client.status = WebsocketTypes.StatusEnum.DISCONNECTED;

  store.dispatch(server.Actions.clearStore());
  store.dispatch(rooms.Actions.clearStore());
  store.dispatch(games.Actions.clearStore());

  if (currentMockInstance) {
    currentMockInstance.onopen = null;
    currentMockInstance.onclose = null;
    currentMockInstance.onerror = null;
    currentMockInstance.onmessage = null;
    currentMockInstance = null;
  }

  (WebClient as unknown as { _instance: WebClient | null })._instance = null;
}

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
    Event_ServerIdentification_ext,
    create(Event_ServerIdentificationSchema, {
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
    Event_ServerIdentification_ext,
    create(Event_ServerIdentificationSchema, {
      serverName: 'TestServer',
      serverVersion: '2.8.0',
      protocolVersion: PROTOCOL_VERSION,
      serverOptions: Event_ServerIdentification_ServerOptions.SupportsPasswordHash,
    })
  ));
}

export function connectAndLogin(userName: string = 'alice'): void {
  connectAndHandshake({ userName });

  const login = findLastSessionCommand(Command_Login_ext);
  const userInfo = create(ServerInfo_UserSchema, {
    name: userName,
    userLevel: ServerInfo_User_UserLevelFlag.IsRegistered,
  });
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: login.cmdId,
    responseCode: Response_ResponseCode.RespOk,
    ext: Response_Login_ext,
    value: create(Response_LoginSchema, {
      userInfo,
      buddyList: [],
      ignoreList: [],
    }),
  })));
}

installMockWebSocket();

beforeEach(() => {
  vi.useFakeTimers();
  new WebClient(
    attachResponseHandlers(store),
    CLIENT_CONFIG,
    CLIENT_OPTIONS,
  );
});

afterEach(() => {
  resetAll();
  vi.clearAllMocks();
  vi.useRealTimers();
});
