const captured = vi.hoisted(() => ({
  wsOptions: null as WebSocketServiceConfig | null,
  pbOptions: null as SocketTransport | null,
}));

vi.mock('./services/WebSocketService', () => ({
  WebSocketService: vi.fn().mockImplementation(function WebSocketServiceImpl(options: WebSocketServiceConfig) {
    captured.wsOptions = options;
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
      send: vi.fn(),
      checkReadyState: vi.fn().mockReturnValue(true),
    };
  }),
}));

vi.mock('./services/ProtobufService', () => ({
  DEFAULT_COMMAND_TIMEOUT_MS: 18_000,
  ProtobufService: vi.fn().mockImplementation(function ProtobufServiceImpl(transport: SocketTransport) {
    captured.pbOptions = transport;
    return {
      handleMessageEvent: vi.fn(),
      resetCommands: vi.fn(),
      replayGameEventContainer: vi.fn(),
    };
  }),
}));

import { WebClient } from './WebClient';
import { WebSocketService } from './services/WebSocketService';
import { ProtobufService } from './services/ProtobufService';
import { StatusEnum } from './types/StatusEnum';
import { Mock } from 'vitest';
import { SocketTransport } from './services/ProtobufService';
import { WebSocketServiceConfig } from './services/WebSocketService';
import type { ClientConfig } from './types/ClientConfig';
import type { ClientOptions } from './types/ClientOptions';
import type { IWebClientResponse } from './types/WebClientResponse';
import type { ConnectTarget } from './types/WebClientConfig';
import { installMockWebSocketHarness } from './testing/mock-websocket';
import { create, setExtension, toBinary } from '@bufbuild/protobuf';
import {
  Event_ServerIdentification_ext,
  Event_ServerIdentification_ServerOptions,
  Event_ServerIdentificationSchema,
  ServerMessageSchema,
  GameEventContainerSchema,
  ServerInfo_GameSchema,
  ServerMessage_MessageType,
  SessionEventSchema,
} from './generated';

const PROTOCOL_VERSION = 14;
const CLIENT_CONFIG: ClientConfig = {
  clientid: 'test-clientid',
  clientver: 'test-client',
  clientfeatures: [],
};
const CLIENT_OPTIONS: ClientOptions = {
  autojoinrooms: false,
  keepalive: 5000,
};

function buildServerIdentificationMessage({
  protocolVersion = PROTOCOL_VERSION,
  serverOptions = 0,
}: { protocolVersion?: number; serverOptions?: number } = {}): Uint8Array {
  const ident = create(Event_ServerIdentificationSchema, {
    serverName: 'TestServer',
    serverVersion: '2.8.0',
    protocolVersion,
    serverOptions,
  });
  const sessionEvent = create(SessionEventSchema);
  setExtension(sessionEvent, Event_ServerIdentification_ext, ident);
  const server = create(ServerMessageSchema, {
    messageType: ServerMessage_MessageType.SESSION_EVENT,
    sessionEvent,
  });
  return toBinary(ServerMessageSchema, server);
}

function makeMockResponse(): IWebClientResponse {
  return {
    session: {
      initialized: vi.fn(),
      connectionAttempted: vi.fn(),
      connectionFailed: vi.fn(),
      connectionUnreachable: vi.fn(),
      clearStore: vi.fn(),
      updateStatus: vi.fn(),
      testConnectionSuccessful: vi.fn(),
      testConnectionFailed: vi.fn(),
    },
    room: { clearStore: vi.fn() },
    game: { clearStore: vi.fn(), replayGameLoaded: vi.fn(), replayGameUnloaded: vi.fn(), replayGameTimeSynced: vi.fn() },
    admin: {},
    moderator: {},
  } as unknown as IWebClientResponse;
}

describe('WebClient', () => {
  let client: WebClient;
  let mockResponse: IWebClientResponse;

  beforeEach(() => {
    (WebClient as unknown as { _instance: WebClient | null })._instance = null;

    (ProtobufService as Mock).mockImplementation(function ProtobufServiceImpl(transport: SocketTransport) {
      captured.pbOptions = transport;
      return {
        handleMessageEvent: vi.fn(),
        resetCommands: vi.fn(),
        replayGameEventContainer: vi.fn(),
      };
    });
    (WebSocketService as Mock).mockImplementation(function WebSocketServiceImpl(options: WebSocketServiceConfig) {
      captured.wsOptions = options;
      return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        dispose: vi.fn(),
        send: vi.fn(),
        checkReadyState: vi.fn().mockReturnValue(true),
      };
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockResponse = makeMockResponse();
    client = new WebClient(mockResponse, CLIENT_CONFIG, CLIENT_OPTIONS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (WebClient as unknown as { _instance: WebClient | null })._instance = null;
  });

  describe('constructor', () => {
    it('forwards live status callbacks and ignores them after disposal', () => {
      captured.wsOptions!.onStatusChange(StatusEnum.CONNECTED, 'Connected');
      expect(mockResponse.session.updateStatus).toHaveBeenCalledExactlyOnceWith(StatusEnum.CONNECTED, 'Connected');
      expect(client.status).toBe(StatusEnum.CONNECTED);
      WebClient.dispose();
      vi.mocked(mockResponse.session.updateStatus).mockClear();
      captured.wsOptions!.onStatusChange(StatusEnum.CONNECTED, 'Late connection');
      expect(mockResponse.session.updateStatus).not.toHaveBeenCalled();
      expect(client.status).toBe(StatusEnum.DISCONNECTED);
    });

    it('connects once and rejects reentrant and disposed connection attempts', () => {
      const target = { host: 'localhost', port: '4748' };
      vi.mocked(client.protobuf.resetCommands).mockImplementationOnce(() => client.connect(target));
      client.connect(target);
      expect(client.socket.connect).toHaveBeenCalledExactlyOnceWith(target);
      expect(mockResponse.session.connectionAttempted).toHaveBeenCalledExactlyOnceWith();
      WebClient.dispose();
      client.connect(target);
      expect(client.socket.connect).toHaveBeenCalledTimes(1);
      expect(mockResponse.session.connectionAttempted).toHaveBeenCalledTimes(1);
    });

    it('abandons reconnect when a settlement callback disposes its owner', () => {
      vi.mocked(client.protobuf.resetCommands).mockImplementationOnce(() => WebClient.dispose());
      client.connect({ host: 'localhost', port: '4748' });
      expect(client.socket.connect).not.toHaveBeenCalled();
      expect(mockResponse.session.connectionAttempted).not.toHaveBeenCalled();
      expect(mockResponse.session.updateStatus).toHaveBeenCalledExactlyOnceWith(StatusEnum.DISCONNECTED, 'Connection Closed');
      expect(() => WebClient.instance).toThrow('WebClient has not been initialized');
    });

    it('allows a live probe but creates no probe after disposal', () => {
      const harness = installMockWebSocketHarness();
      vi.useFakeTimers();
      try {
        client.testConnect({ host: 'localhost', port: '4748' });
        expect(harness.MockWS).toHaveBeenCalledExactlyOnceWith('ws://localhost:4748');
        WebClient.dispose();
        client.testConnect({ host: 'elsewhere', port: '4749' });
        expect(harness.MockWS).toHaveBeenCalledTimes(1);
        expect(mockResponse.session.testConnectionSuccessful).not.toHaveBeenCalled();
        expect(mockResponse.session.testConnectionFailed).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        harness.restore();
      }
    });

    it('stores the response, clientConfig, clientOptions, and protocolVersion on the instance', () => {
      expect(client.response).toBe(mockResponse);
      expect(client.clientConfig).toBe(CLIENT_CONFIG);
      expect(client.clientOptions).toBe(CLIENT_OPTIONS);
      expect(client.protocolVersion).toBe(PROTOCOL_VERSION);
    });

    it('wires onMessage to protobuf.handleMessageEvent', () => {
      const event = { data: new ArrayBuffer(0) } as MessageEvent;
      captured.wsOptions!.onMessage(event);
      expect(client.protobuf.handleMessageEvent).toHaveBeenCalledWith(event);
    });

    it('calls response.session.initialized', () => {
      expect(mockResponse.session.initialized).toHaveBeenCalled();
    });

    it('forwards round-trip stats from protobuf to response.session.updateLatencyStats', () => {
      const onLatencyStats = (ProtobufService as Mock).mock.lastCall![3];
      const stats = { lastMs: 40, medianMs: 40, p95Ms: 40, maxMs: 40, sampleCount: 1 };
      mockResponse.session.updateLatencyStats = vi.fn();

      onLatencyStats(stats, [40]);

      expect(mockResponse.session.updateLatencyStats).toHaveBeenCalledWith(stats, [40]);
    });

    it('sets WebClient.instance to the constructed instance', () => {
      expect(WebClient.instance).toBe(client);
    });

    it('throws when instantiated more than once', () => {
      expect(() => new WebClient(makeMockResponse(), CLIENT_CONFIG, CLIENT_OPTIONS)).toThrow(/singleton/);
    });
  });

  describe('static instance accessor', () => {
    it('throws when accessed before construction', () => {
      (WebClient as unknown as { _instance: WebClient | null })._instance = null;
      expect(() => WebClient.instance).toThrow(/not been initialized/);
    });
  });

  describe('static dispose', () => {
    it('clears the singleton so a new WebClient can be constructed', () => {
      expect(WebClient.instance).toBe(client);
      WebClient.dispose();
      const fresh = new WebClient(makeMockResponse(), CLIENT_CONFIG, CLIENT_OPTIONS);
      expect(WebClient.instance).toBe(fresh);
    });

    it('closes any open socket before clearing the instance', () => {
      const disconnectSpy = client.socket.dispose as Mock;
      WebClient.dispose();
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('leaves the static accessor in a thrown state until re-construction', () => {
      WebClient.dispose();
      expect(() => WebClient.instance).toThrow(/not been initialized/);
    });

    it('is a no-op when no instance exists', () => {
      (WebClient as unknown as { _instance: WebClient | null })._instance = null;
      expect(() => WebClient.dispose()).not.toThrow();
    });
  });

  describe('connect', () => {
    it('calls response.session.connectionAttempted', () => {
      const target: ConnectTarget = { host: 'h', port: '1' };
      client.connect(target);
      expect(mockResponse.session.connectionAttempted).toHaveBeenCalled();
    });

    it('calls socket.connect with target', () => {
      const target: ConnectTarget = { host: 'h', port: '1' };
      client.connect(target);
      expect(client.socket.connect).toHaveBeenCalledWith(target);
    });
  });

  describe('testConnect', () => {
    let MockWS: ReturnType<typeof installMockWebSocketHarness>['MockWS'];
    let wsMockInstance: ReturnType<typeof installMockWebSocketHarness>['mockInstance'];
    let restoreWS: ReturnType<typeof installMockWebSocketHarness>['restore'];

    beforeEach(() => {
      vi.useFakeTimers();
      const installed = installMockWebSocketHarness();
      MockWS = installed.MockWS;
      wsMockInstance = installed.mockInstance;
      restoreWS = installed.restore;
    });

    afterEach(() => {
      restoreWS();
      vi.useRealTimers();
    });

    const target: ConnectTarget = { host: 'h', port: '1' };

    it('creates a WebSocket with the correct URL', () => {
      client.testConnect(target);
      expect(MockWS).toHaveBeenCalledWith(expect.stringContaining('://h:1'));
    });

    it('routes path-bearing hosts through the default TLS port (nginx proxy)', () => {
      client.testConnect({ host: 'server.example.com/servatrice', port: '4748' });
      expect(MockWS).toHaveBeenCalledWith(expect.stringMatching(/:\/\/server\.example\.com\/servatrice$/));
    });

    it('dispatches testConnectionSuccessful with supportsHashedPassword=true when the bit is set', () => {
      client.testConnect(target);
      const data = buildServerIdentificationMessage({
        serverOptions: Event_ServerIdentification_ServerOptions.SupportsPasswordHash,
      });
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.testConnectionSuccessful).toHaveBeenCalledWith(true);
      expect(wsMockInstance.close).toHaveBeenCalled();
    });

    it('dispatches testConnectionSuccessful with supportsHashedPassword=false for naked-password servers', () => {
      client.testConnect(target);
      const data = buildServerIdentificationMessage({ serverOptions: 0 });
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.testConnectionSuccessful).toHaveBeenCalledWith(false);
    });

    it('fails on protocol-version mismatch instead of reporting success', () => {
      client.testConnect(target);
      const data = buildServerIdentificationMessage({ protocolVersion: PROTOCOL_VERSION + 1 });
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.testConnectionFailed).toHaveBeenCalled();
      expect(mockResponse.session.testConnectionSuccessful).not.toHaveBeenCalled();
    });

    it('does not signal connectionUnreachable on a protocol-version mismatch (server was reached)', () => {
      client.testConnect(target);
      const data = buildServerIdentificationMessage({ protocolVersion: PROTOCOL_VERSION + 1 });
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.connectionUnreachable).not.toHaveBeenCalled();
    });

    it('does not signal connectionUnreachable on a decode failure (bytes were received)', () => {
      client.testConnect(target);
      wsMockInstance.onmessage({ data: new Uint8Array([0xff, 0xff, 0xff, 0xff]).buffer });
      expect(mockResponse.session.testConnectionFailed).toHaveBeenCalled();
      expect(mockResponse.session.connectionUnreachable).not.toHaveBeenCalled();
    });

    it('does not signal connectionUnreachable on a successful probe', () => {
      client.testConnect(target);
      const data = buildServerIdentificationMessage();
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.testConnectionSuccessful).toHaveBeenCalled();
      expect(mockResponse.session.connectionUnreachable).not.toHaveBeenCalled();
    });

    it('calls testConnectionFailed on error', () => {
      client.testConnect(target);
      wsMockInstance.onerror();
      expect(mockResponse.session.testConnectionFailed).toHaveBeenCalled();
      expect(wsMockInstance.close).toHaveBeenCalled();
    });

    it('signals connectionUnreachable on a transport error (never reached the server)', () => {
      client.testConnect(target);
      wsMockInstance.onerror();
      expect(mockResponse.session.connectionUnreachable).toHaveBeenCalled();
    });

    it('signals connectionUnreachable when the probe closes before identification', () => {
      client.testConnect(target);
      wsMockInstance.onclose();
      expect(mockResponse.session.connectionUnreachable).toHaveBeenCalled();
    });

    it('fires testConnectionFailed when ServerIdentification never arrives before the keepalive timeout', () => {
      client.testConnect(target);
      vi.advanceTimersByTime(5000);
      expect(wsMockInstance.close).toHaveBeenCalled();
      expect(mockResponse.session.testConnectionFailed).toHaveBeenCalled();
    });

    it('signals connectionUnreachable when the probe hits the keepalive timeout', () => {
      client.testConnect(target);
      vi.advanceTimersByTime(5000);
      expect(mockResponse.session.connectionUnreachable).toHaveBeenCalled();
    });

    it('closes an already-open prior probe immediately on rapid re-click', () => {
      const { instances } = installMockWebSocketHarness();
      // The fresh installMockWebSocketHarness replaces the stub from beforeEach so
      // we observe the next two constructions in isolation.
      client.testConnect(target);
      const first = instances[instances.length - 1];
      first.readyState = WebSocket.OPEN;
      expect(first.close).not.toHaveBeenCalled();

      client.testConnect(target);
      expect(first.close).toHaveBeenCalled();
    });

    it('does not abort a still-CONNECTING prior probe — defers a clean close to onopen', () => {
      const { instances } = installMockWebSocketHarness();
      client.testConnect(target);
      const first = instances[instances.length - 1];
      first.readyState = WebSocket.CONNECTING;

      client.testConnect(target);
      expect(first.close).not.toHaveBeenCalled();
      expect(typeof first.onopen).toBe('function');

      first.onopen?.();
      expect(first.close).toHaveBeenCalled();
    });

    it('uses wss:// for a remote target', () => {
      client.testConnect(target);
      expect(MockWS).toHaveBeenCalledWith(expect.stringMatching(/^wss:\/\//));
    });

    it('uses ws:// for a local target', () => {
      client.testConnect({ host: 'localhost', port: '4748' });
      expect(MockWS).toHaveBeenCalledWith(expect.stringMatching(/^ws:\/\//));
    });

    it('ignores a second resolve once already resolved', () => {
      client.testConnect(target);
      const data = buildServerIdentificationMessage();
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.testConnectionSuccessful).toHaveBeenCalledTimes(1);
      // Now an error fires after success — the resolved guard should prevent
      // a stray testConnectionFailed.
      wsMockInstance.onerror();
      expect(mockResponse.session.testConnectionFailed).not.toHaveBeenCalled();
      expect(mockResponse.session.testConnectionSuccessful).toHaveBeenCalledTimes(1);
    });

    it('does not dispatch when a superseded socket resolves late', () => {
      // First testConnect: capture socket A (the one set up in beforeEach).
      client.testConnect(target);
      const socketA = wsMockInstance;
      const lateMessage = socketA.onmessage!;
      expect(lateMessage).toEqual(expect.any(Function));

      // Second testConnect: a fresh installMockWebSocketHarness gives us socket B,
      // and the WebClient's testSocket is now B (not A).
      const { mockInstance: socketB } = installMockWebSocketHarness();
      client.testConnect(target);
      expect(socketB).not.toBe(socketA);
      expect(socketA.onmessage).toBeNull();

      const data = buildServerIdentificationMessage();
      const message = new MessageEvent('message', { data: data.buffer });
      lateMessage(message);
      expect(mockResponse.session.testConnectionSuccessful).not.toHaveBeenCalled();
      expect(mockResponse.session.testConnectionFailed).not.toHaveBeenCalled();
      expect(mockResponse.session.connectionUnreachable).not.toHaveBeenCalled();

      socketB.onmessage!(message);
      expect(mockResponse.session.testConnectionSuccessful).toHaveBeenCalledExactlyOnceWith(false);
    });

    it('ignores non-SESSION_EVENT messages', () => {
      client.testConnect(target);
      const server = create(ServerMessageSchema, {
        messageType: ServerMessage_MessageType.RESPONSE,
      });
      const data = toBinary(ServerMessageSchema, server);
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.testConnectionSuccessful).not.toHaveBeenCalled();
      expect(mockResponse.session.testConnectionFailed).not.toHaveBeenCalled();
    });

    it('ignores SESSION_EVENT messages without ServerIdentification extension', () => {
      client.testConnect(target);
      const sessionEvent = create(SessionEventSchema);
      const server = create(ServerMessageSchema, {
        messageType: ServerMessage_MessageType.SESSION_EVENT,
        sessionEvent,
      });
      const data = toBinary(ServerMessageSchema, server);
      wsMockInstance.onmessage({ data: data.buffer });
      expect(mockResponse.session.testConnectionSuccessful).not.toHaveBeenCalled();
      expect(mockResponse.session.testConnectionFailed).not.toHaveBeenCalled();
    });

    it('fails when message data cannot be decoded', () => {
      client.testConnect(target);
      // Garbage bytes — fromBinary throws, the catch block runs resolve(false).
      wsMockInstance.onmessage({ data: new Uint8Array([0xff, 0xff, 0xff, 0xff]).buffer });
      expect(mockResponse.session.testConnectionFailed).toHaveBeenCalled();
    });

    it('fails when the socket closes before identification', () => {
      client.testConnect(target);
      wsMockInstance.onclose();
      expect(mockResponse.session.testConnectionFailed).toHaveBeenCalled();
      expect(wsMockInstance.close).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('delegates to socket.disconnect', () => {
      client.disconnect();
      expect(client.socket.disconnect).toHaveBeenCalled();
    });
  });

  describe('replay games', () => {
    it('forwards a recorded container and the local replay id to protobuf', () => {
      const container = create(GameEventContainerSchema, { gameId: 7, secondsElapsed: 12 });
      client.replayGameEventContainer(container, -1001);
      expect(vi.mocked(client.protobuf.replayGameEventContainer).mock.calls).toEqual([[container, -1001, undefined]]);
      expect(vi.mocked(client.socket.send).mock.calls).toEqual([]);
    });

    it('loadReplayGame hands the replay game to the game response', () => {
      const gameInfo = create(ServerInfo_GameSchema, { gameId: 7, description: 'recorded' });
      client.loadReplayGame(-1001, gameInfo);
      expect(mockResponse.game.replayGameLoaded).toHaveBeenCalledWith(-1001, gameInfo);
    });

    it.each([true, false])('forwards skipRevealWindow=%s to replay dispatch', (skipRevealWindow) => {
      const container = create(GameEventContainerSchema, { secondsElapsed: 12 });
      const options = { skipRevealWindow };
      client.protobuf.replayGameEventContainer = vi.fn();

      client.replayGameEventContainer(container, -1001, options);

      expect(client.protobuf.replayGameEventContainer).toHaveBeenCalledWith(container, -1001, options);
    });

    it('unloadReplayGame hands the closed replay game to the game response', () => {
      client.unloadReplayGame(-1001);
      expect(mockResponse.game.replayGameUnloaded).toHaveBeenCalledWith(-1001);
    });

    it('replayGameEventContainer reports the container\'s game time before playing its events', () => {
      const container = create(GameEventContainerSchema, { secondsElapsed: 95 });
      client.protobuf.replayGameEventContainer = vi.fn();
      client.replayGameEventContainer(container, -1001);
      expect(mockResponse.game.replayGameTimeSynced).toHaveBeenCalledWith(-1001, 95);
      expect(client.protobuf.replayGameEventContainer).toHaveBeenCalledWith(container, -1001, undefined);
      expect(vi.mocked(mockResponse.game.replayGameTimeSynced!).mock.invocationCallOrder[0])
        .toBeLessThan(vi.mocked(client.protobuf.replayGameEventContainer).mock.invocationCallOrder[0]);
    });

    it('replayGameEventContainer reports no game time for a container without one', () => {
      client.protobuf.replayGameEventContainer = vi.fn();
      client.replayGameEventContainer(create(GameEventContainerSchema, {}), -1001);
      expect(mockResponse.game.replayGameTimeSynced).not.toHaveBeenCalled();
      expect(client.protobuf.replayGameEventContainer).toHaveBeenCalled();
    });

    it('replayGameEventContainer reports a recorded game time of 0', () => {
      client.protobuf.replayGameEventContainer = vi.fn();
      client.replayGameEventContainer(create(GameEventContainerSchema, { secondsElapsed: 0 }), -1001);
      expect(mockResponse.game.replayGameTimeSynced).toHaveBeenCalledWith(-1001, 0);
    });

    it('replayGameEventContainer forwards timed containers when the clock callback is absent', () => {
      delete mockResponse.game.replayGameTimeSynced;
      const container = create(GameEventContainerSchema, { secondsElapsed: 95 });
      client.protobuf.replayGameEventContainer = vi.fn();

      client.replayGameEventContainer(container, -1001);

      expect(vi.mocked(client.protobuf.replayGameEventContainer).mock.calls).toEqual([[container, -1001, undefined]]);
    });
  });

  describe('updateStatus', () => {
    it('sets the status', () => {
      client.updateStatus(StatusEnum.CONNECTED);
      expect(client.status).toBe(StatusEnum.CONNECTED);
    });

    it('calls protobuf.resetCommands on DISCONNECTED', () => {
      client.updateStatus(StatusEnum.DISCONNECTED);
      expect(client.protobuf.resetCommands).toHaveBeenCalled();
    });

    it('calls protobuf.resetCommands on RECONNECTING (commands on the dropped socket can never be answered)', () => {
      client.updateStatus(StatusEnum.RECONNECTING);
      expect(client.protobuf.resetCommands).toHaveBeenCalled();
    });

    it('does not reset protobuf when status is not DISCONNECTED', () => {
      client.updateStatus(StatusEnum.CONNECTED);
      expect(client.protobuf.resetCommands).not.toHaveBeenCalled();
    });
  });

  describe('isReconnecting', () => {
    it('is true when status is RECONNECTING', () => {
      client.updateStatus(StatusEnum.RECONNECTING);
      expect(client.isReconnecting).toBe(true);
    });

    it('is false for any other status', () => {
      client.updateStatus(StatusEnum.CONNECTED);
      expect(client.isReconnecting).toBe(false);
    });
  });

  describe('constructor closures', () => {
    it('keepAliveFn is set to ping function in WebSocketService', () => {
      expect(captured.wsOptions!.keepAliveFn).toBeDefined();
      expect(typeof captured.wsOptions!.keepAliveFn).toBe('function');
    });

    it('onStatusChange routes to response.session.updateStatus and updates own status', () => {
      captured.wsOptions!.onStatusChange(StatusEnum.CONNECTED, 'Connected');
      expect(mockResponse.session.updateStatus).toHaveBeenCalledWith(StatusEnum.CONNECTED, 'Connected');
      expect(client.status).toBe(StatusEnum.CONNECTED);
    });

    it('onConnectionFailed routes to response.session.connectionFailed', () => {
      captured.wsOptions!.onConnectionFailed();
      expect(mockResponse.session.connectionFailed).toHaveBeenCalled();
    });

    it('onConnectionUnreachable routes to response.session.connectionUnreachable', () => {
      captured.wsOptions!.onConnectionUnreachable!();
      expect(mockResponse.session.connectionUnreachable).toHaveBeenCalled();
    });

    it('send closure delegates to socket.send', () => {
      const data = new Uint8Array([1, 2, 3]);
      captured.pbOptions!.send(data);
      expect(client.socket.send).toHaveBeenCalledWith(data);
    });

    it('isOpen closure delegates to socket.checkReadyState', () => {
      const result = captured.pbOptions!.isOpen();
      expect(client.socket.checkReadyState).toHaveBeenCalledWith(WebSocket.OPEN);
      expect(result).toBe(true);
    });
  });
});
