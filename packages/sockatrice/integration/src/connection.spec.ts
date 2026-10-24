// Connection-lifecycle scenarios. Exercises the full transport handshake
// from webClient.connect() through onopen, ServerIdentification, and
// disconnect — with only the browser WebSocket constructor mocked.
//
// Diff from webclient: Redux state assertions are replaced with assertions
// on the response stub (see ../helpers/web-client-stubs) and on the
// WebClient's own `status` property.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi, type Mock } from 'vitest';

import * as Data from '../../src/generated';
import { AuthenticationCommands } from '../../src';
import { WebsocketTypes } from '../../src/types';

import {
  getMockResponse,
  getMockWebSocket,
  getWebClient,
  openMockWebSocket,
  setPendingOptions,
  connectAndHandshake,
  connectAndHandshakeWithSalt,
  connectAndLogin,
  PROTOCOL_VERSION,
} from '../../src/testing/setup';
import {
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

function loginOptions(overrides: Partial<{ userName: string; password: string }> = {}): WebsocketTypes.WebSocketConnectOptions {
  return {
    reason: WebsocketTypes.WebSocketConnectReason.LOGIN,
    host: 'localhost',
    port: '4748',
    userName: overrides.userName ?? 'alice',
    password: overrides.password ?? 'secret',
  };
}

function connectWithOptions(opts: WebsocketTypes.WebSocketConnectOptions): void {
  setPendingOptions(opts);
  getWebClient().connect({ host: opts.host, port: opts.port });
}

function serverIdentification(
  protocolVersion = PROTOCOL_VERSION,
  serverName = 'TestServer',
  serverVersion = '2.8.0'
): Uint8Array {
  const payload = create(Data.Event_ServerIdentificationSchema, {
    serverName,
    serverVersion,
    protocolVersion,
    serverOptions: Data.Event_ServerIdentification_ServerOptions.NoOptions,
  });
  return buildSessionEventMessage(Data.Event_ServerIdentification_ext, payload);
}

describe('connection lifecycle', () => {
  it('exposes the most recent connect target before and after replacing the socket', () => {
    const client = getWebClient();
    expect(client.socket.target).toBeNull();

    connectWithOptions(loginOptions());
    expect(client.socket.target).toEqual({ host: 'localhost', port: '4748' });
    expect(getMockWebSocket().url).toBe('ws://localhost:4748');

    connectWithOptions({ ...loginOptions(), host: 'server.example', port: '8443' });
    expect(client.socket.target).toEqual({ host: 'server.example', port: '8443' });
    expect(getMockWebSocket().url).toBe('wss://server.example:8443');
  });

  it('flips status through CONNECTING → CONNECTED on socket open', () => {
    connectWithOptions(loginOptions());

    expect(getMockResponse().session.connectionAttempted).toHaveBeenCalled();

    openMockWebSocket();

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.CONNECTED);
    expect(getMockResponse().session.updateStatus).toHaveBeenCalledWith(
      WebsocketTypes.StatusEnum.CONNECTED,
      'Connected',
    );
  });

  it('routes a matching ServerIdentification into LOGGING_IN and sends Command_Login', () => {
    connectWithOptions(loginOptions({ userName: 'alice' }));
    openMockWebSocket();

    deliverMessage(serverIdentification());

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.LOGGING_IN);
    expect(getMockResponse().session.updateInfo).toHaveBeenCalledWith('TestServer', '2.8.0', false);

    const { value, cmdId } = findLastSessionCommand(Data.Command_Login_ext);
    expect(value.userName).toBe('alice');
    expect(cmdId).toBeGreaterThan(0);
  });

  it('disconnects on protocol version mismatch without sending a login command', () => {
    connectWithOptions(loginOptions());
    openMockWebSocket();

    deliverMessage(serverIdentification(PROTOCOL_VERSION + 1));

    const mock = getMockWebSocket();
    expect(mock.close).toHaveBeenCalled();
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
    expect(() => findLastSessionCommand(Data.Command_Login_ext)).toThrow();
  });

  it('times out when onopen never fires within the keepalive window', () => {
    connectWithOptions(loginOptions());

    const mock = getMockWebSocket();
    expect(mock.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);

    // Fire onclose the way a real browser would when the connection-attempt
    // timer closes a still-connecting socket.
    mock.onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);

    expect(mock.close).toHaveBeenCalled();
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });

  it('releases keep-alive ping loop on explicit disconnect', () => {
    connectWithOptions(loginOptions());
    openMockWebSocket();
    deliverMessage(serverIdentification());

    const mock = getMockWebSocket();
    getWebClient().disconnect();
    // The transport schedules close() synchronously; onclose follows in the
    // browser event loop. Simulate it so the status transition fires.
    mock.onclose?.({ code: 1000, reason: '', wasClean: true } as CloseEvent);

    expect(mock.close).toHaveBeenCalled();
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });

  it('enters RECONNECTING on unexpected socket close after a successful login', () => {
    connectAndLogin();

    const mock = getMockWebSocket();
    mock.readyState = 3;
    mock.onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.RECONNECTING);
  });

  it('fails a login that is in flight when the socket drops', () => {
    connectAndHandshake();
    expect(() => findLastSessionCommand(Data.Command_Login_ext)).not.toThrow();

    const mock = getMockWebSocket();
    mock.readyState = 3;
    mock.onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);

    expect(getMockResponse().session.loginFailed).toHaveBeenCalledTimes(1);
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.RECONNECTING);
  });

  it('keeps reconnecting when a password-salt request is cut off by the drop', () => {
    connectAndHandshakeWithSalt();
    expect(() => findLastSessionCommand(Data.Command_RequestPasswordSalt_ext)).not.toThrow();
    const sockets = (globalThis.WebSocket as unknown as Mock).mock.calls.length;

    const mock = getMockWebSocket();
    mock.readyState = 3;
    mock.onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);

    expect(getMockResponse().session.loginFailed).toHaveBeenCalledTimes(1);
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.RECONNECTING);

    vi.advanceTimersByTime(1000);
    expect((globalThis.WebSocket as unknown as Mock).mock.calls.length).toBe(sockets + 1);
  });

  it('login() caches the pending options, flips to CONNECTING, and opens the socket', () => {
    // Exercises the real AuthenticationCommands.login → beginConnect path that
    // the connect* helpers above bypass.
    AuthenticationCommands.login({ host: 'localhost', port: '4748', userName: 'alice', password: 'secret' });

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.CONNECTING);
    expect(getMockResponse().session.updateStatus).toHaveBeenCalledWith(
      WebsocketTypes.StatusEnum.CONNECTING,
      'Connecting...',
    );
    expect(getMockResponse().session.connectionAttempted).toHaveBeenCalled();
    // A mock WebSocket was constructed — connect() reached the transport layer.
    expect(() => getMockWebSocket()).not.toThrow();

    // The cached options drive the handshake: opening the socket and delivering
    // a matching ServerIdentification routes into LOGGING_IN and sends Command_Login.
    openMockWebSocket();
    deliverMessage(serverIdentification());

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.LOGGING_IN);
    expect(findLastSessionCommand(Data.Command_Login_ext).value.userName).toBe('alice');
  });
});

describe('connected endpoint identity', () => {
  it.each([
    ['example.com', '4748', 'wss://example.com:4748'],
    ['example.com/server-a', '4748', 'wss://example.com/server-a'],
  ])('only exposes the live socket URL for %s', (host, port, endpoint) => {
    const client = getWebClient();
    expect(client.socket.connectedEndpoint).toBeNull();
    client.connect({ host, port });
    expect(client.socket.connectedEndpoint).toBeNull();
    openMockWebSocket();
    expect(client.socket.connectedEndpoint).toBe(endpoint);
    getMockWebSocket().readyState = WebSocket.CLOSED;
    expect(client.socket.connectedEndpoint).toBeNull();
    getMockWebSocket().readyState = WebSocket.OPEN;
    expect(client.socket.connectedEndpoint).toBe(endpoint);
    client.disconnect();
    expect(client.socket.connectedEndpoint).toBeNull();
    expect(getMockWebSocket().close.mock.calls).toEqual([[]]);
  });
});
