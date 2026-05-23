// Test-connection probe — the "can I reach this server?" check the login form
// runs before the user commits to connecting. Drives the real
// AuthenticationCommands.testConnection -> WebClient.testConnect path, which
// opens its own short-lived WebSocket (separate from the main connection) and
// waits for an Event_ServerIdentification to judge reachability and protocol
// compatibility.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { AuthenticationCommands } from '../../src';

import {
  getMockResponse,
  getMockWebSocket,
  PROTOCOL_VERSION,
} from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';

const TARGET = { host: 'localhost', port: '4748' };

function serverIdentification(overrides: {
  protocolVersion?: number;
  serverOptions?: Data.Event_ServerIdentification_ServerOptions;
} = {}): Uint8Array {
  return buildSessionEventMessage(
    Data.Event_ServerIdentification_ext,
    create(Data.Event_ServerIdentificationSchema, {
      serverName: 'TestServer',
      serverVersion: '2.8.0',
      protocolVersion: overrides.protocolVersion ?? PROTOCOL_VERSION,
      serverOptions:
        overrides.serverOptions ?? Data.Event_ServerIdentification_ServerOptions.NoOptions,
    })
  );
}

describe('test connection', () => {
  it('reports success when the server identifies with a matching protocol', () => {
    AuthenticationCommands.testConnection(TARGET);

    deliverMessage(serverIdentification());

    expect(getMockResponse().session.testConnectionSuccessful).toHaveBeenCalledWith(false);
    expect(getMockResponse().session.testConnectionFailed).not.toHaveBeenCalled();
  });

  it('flags hashed-password support from the server options bitmask', () => {
    AuthenticationCommands.testConnection(TARGET);

    deliverMessage(serverIdentification({
      serverOptions: Data.Event_ServerIdentification_ServerOptions.SupportsPasswordHash,
    }));

    expect(getMockResponse().session.testConnectionSuccessful).toHaveBeenCalledWith(true);
  });

  it('reports failure on a protocol version mismatch', () => {
    AuthenticationCommands.testConnection(TARGET);

    deliverMessage(serverIdentification({ protocolVersion: PROTOCOL_VERSION + 1 }));

    expect(getMockResponse().session.testConnectionFailed).toHaveBeenCalled();
    expect(getMockResponse().session.testConnectionSuccessful).not.toHaveBeenCalled();
  });

  it('reports failure when the probe socket errors', () => {
    AuthenticationCommands.testConnection(TARGET);

    getMockWebSocket().onerror?.(new Event('error'));

    expect(getMockResponse().session.testConnectionFailed).toHaveBeenCalled();
  });

  it('reports failure when the probe socket closes before identifying', () => {
    AuthenticationCommands.testConnection(TARGET);

    getMockWebSocket().onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);

    expect(getMockResponse().session.testConnectionFailed).toHaveBeenCalled();
  });

  it('reports failure when the server never identifies within the keepalive window', () => {
    AuthenticationCommands.testConnection(TARGET);

    vi.advanceTimersByTime(5000);

    expect(getMockResponse().session.testConnectionFailed).toHaveBeenCalled();
  });

  it('reports failure when the probe receives undecodable bytes', () => {
    AuthenticationCommands.testConnection(TARGET);

    // Field number 0 is invalid protobuf — fromBinary throws, hitting the
    // onmessage catch.
    deliverMessage(new Uint8Array([0x00]));

    expect(getMockResponse().session.testConnectionFailed).toHaveBeenCalled();
  });

  it('ignores traffic that is not a server identification', () => {
    AuthenticationCommands.testConnection(TARGET);

    // A RESPONSE-typed message — not a session event at all.
    deliverMessage(buildResponseMessage(buildResponse({ cmdId: 1 })));
    // A session event that is not a ServerIdentification.
    deliverMessage(buildSessionEventMessage(
      Data.Event_ServerMessage_ext,
      create(Data.Event_ServerMessageSchema, { message: 'unrelated' })
    ));

    expect(getMockResponse().session.testConnectionSuccessful).not.toHaveBeenCalled();
    expect(getMockResponse().session.testConnectionFailed).not.toHaveBeenCalled();

    // The probe still resolves once a real identification arrives.
    deliverMessage(serverIdentification());
    expect(getMockResponse().session.testConnectionSuccessful).toHaveBeenCalledWith(false);
  });

  it('eagerly closes a prior probe socket when a new test starts', () => {
    AuthenticationCommands.testConnection(TARGET);
    const firstSocket = getMockWebSocket();

    AuthenticationCommands.testConnection(TARGET);
    const secondSocket = getMockWebSocket();

    expect(firstSocket.close).toHaveBeenCalled();
    expect(secondSocket).not.toBe(firstSocket);
  });
});
