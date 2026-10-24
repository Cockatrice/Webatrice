import { describe, expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import * as Data from '../../src/generated';
import { SessionCommands, WebClient } from '../../src';
import { CommandFailure } from '../../src/types/CommandFailure';
import { StatusEnum } from '../../src/types/StatusEnum';
import { DEFAULT_COMMAND_TIMEOUT_MS } from '../../src/services/ProtobufService';
import {
  CLIENT_CONFIG, connectRaw, connectAndHandshakeWithSalt, getMockResponse, getMockWebSocket,
  getWebClient, createWebClientForTest,
} from '../../src/testing/setup';
import { findLastSessionCommand } from '../../src/testing/command-capture';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { WebSocketConnectReason } from '../../src/types/ConnectOptions';

const target = { host: 'localhost', port: '4748', userName: 'alice' };
const cases = [
  {
    name: 'login', send: () => SessionCommands.login(target, 'secret'),
    capture: () => findLastSessionCommand(Data.Command_Login_ext),
    wire: create(Data.Command_LoginSchema, { ...CLIENT_CONFIG, userName: 'alice', password: 'secret' }),
    callback: () => getMockResponse().session.loginFailed,
    args: (code: number, _outcome: string) => [code],
    status: (outcome: string, code: number) => outcome === 'timeout'
      ? 'Login failed: the server did not respond' : `Login failed: unknown error: ${code}`,
  },
  {
    name: 'register', send: () => SessionCommands.register({ ...target, email: 'a@b.test', country: 'AU', realName: 'A' }, 'secret'),
    capture: () => findLastSessionCommand(Data.Command_Register_ext),
    wire: create(Data.Command_RegisterSchema, {
      ...CLIENT_CONFIG, userName: 'alice', email: 'a@b.test', country: 'AU', realName: 'A', password: 'secret',
    }),
    callback: () => getMockResponse().session.registrationFailed,
    args: (_code: number, outcome: string) => [outcome === 'disconnected' ? 'The connection to the server has been lost.'
      : outcome === 'timeout' ? 'The server did not respond. Please try again.' : 'Registration failed due to a server issue'],
    status: () => 'Registration failed',
  },
  {
    name: 'activate', send: () => SessionCommands.activate({ ...target, token: 'token' }, 'secret'),
    capture: () => findLastSessionCommand(Data.Command_Activate_ext),
    wire: create(Data.Command_ActivateSchema, { ...CLIENT_CONFIG, userName: 'alice', token: 'token' }),
    callback: () => getMockResponse().session.accountActivationFailed,
    args: (_code: number, outcome: string) => [
      outcome === 'rejected' ? undefined : outcome === 'timeout' ? CommandFailure.Timeout : CommandFailure.Disconnected,
    ],
    status: () => 'Account Activation Failed',
  },
];

describe.each(cases)('$name failure settlement', (testCase) => {
  it.each(['rejected', 'timeout', 'disconnected'] as const)('reports exact %s outcome', (outcome) => {
    connectRaw();
    testCase.send();
    const { cmdId, value } = testCase.capture();
    expect(value).toStrictEqual(testCase.wire);
    vi.mocked(getMockResponse().session.updateStatus).mockClear();
    const socket = getMockWebSocket();
    const code = outcome === 'rejected' ? Data.Response_ResponseCode.RespInvalidCommand : Data.Response_ResponseCode.RespNotConnected;
    if (outcome === 'rejected') {
      deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: code })));
    } else if (outcome === 'timeout') {
      vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    } else {
      socket.readyState = WebSocket.CLOSED;
      socket.onclose!();
    }
    expect(testCase.callback()).toHaveBeenCalledExactlyOnceWith(...testCase.args(code, outcome));
    if (outcome === 'disconnected') {
      expect(vi.mocked(getMockResponse().session.updateStatus).mock.calls).toEqual([
        [StatusEnum.RECONNECTING, 'Reconnecting (attempt 1/5)'],
      ]);
      expect(socket.close).not.toHaveBeenCalled();
    } else {
      expect(getMockResponse().session.updateStatus).toHaveBeenNthCalledWith(1, StatusEnum.DISCONNECTED, testCase.status(outcome, code));
      expect(socket.close).toHaveBeenCalledExactlyOnceWith();
    }
  });
});

it.each(['success', 'rejected', 'timeout', 'disconnected'] as const)('reports exact password salt %s outcome', (outcome) => {
  connectRaw();
  const success = vi.fn();
  const failure = vi.fn();
  SessionCommands.requestPasswordSalt(target, success, failure);
  const { cmdId, value } = findLastSessionCommand(Data.Command_RequestPasswordSalt_ext);
  expect(value).toStrictEqual(create(Data.Command_RequestPasswordSaltSchema, { ...CLIENT_CONFIG, userName: 'alice' }));
  vi.mocked(getMockResponse().session.updateStatus).mockClear();
  if (outcome === 'success') {
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, ext: Data.Response_PasswordSalt_ext,
      value: create(Data.Response_PasswordSaltSchema, { passwordSalt: 'salt' }) })));
    expect(success).toHaveBeenCalledExactlyOnceWith('salt');
    expect(failure).not.toHaveBeenCalled();
    expect(getMockResponse().session.updateStatus).not.toHaveBeenCalled();
  } else {
    if (outcome === 'rejected') {
      deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespInvalidCommand })));
    } else if (outcome === 'timeout') {
      vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    } else {
      getWebClient().disconnect();
    }
    const reason = outcome === 'rejected' ? undefined : outcome === 'timeout' ? CommandFailure.Timeout : CommandFailure.Disconnected;
    expect(failure).toHaveBeenCalledExactlyOnceWith(reason);
    expect(success).not.toHaveBeenCalled();
    expect(vi.mocked(getMockResponse().session.updateStatus).mock.calls).toEqual([[StatusEnum.DISCONNECTED,
      outcome === 'disconnected' ? 'Connection Closed' : outcome === 'timeout'
        ? 'Login failed: the server did not respond' : 'Login failed: Unknown Reason']]);
  }
});

it.each([WebSocketConnectReason.ACTIVATE_ACCOUNT, WebSocketConnectReason.PASSWORD_RESET])(
  'settles the salt-dependent form for connection reason %s', (reason) => {
    connectAndHandshakeWithSalt({ reason, token: 'token', newPassword: 'new-secret' });
    const { value } = findLastSessionCommand(Data.Command_RequestPasswordSalt_ext);
    expect(value).toStrictEqual(create(Data.Command_RequestPasswordSaltSchema, { ...CLIENT_CONFIG, userName: 'alice' }));
    getWebClient().disconnect();
    const session = getMockResponse().session;
    if (reason === WebSocketConnectReason.ACTIVATE_ACCOUNT) {
      expect(session.accountActivationFailed).toHaveBeenCalledExactlyOnceWith(CommandFailure.Disconnected);
      expect(session.resetPasswordFailed).not.toHaveBeenCalled();
    } else {
      expect(session.resetPasswordFailed).toHaveBeenCalledExactlyOnceWith();
      expect(session.accountActivationFailed).not.toHaveBeenCalled();
    }
    expect(getMockWebSocket().close).toHaveBeenCalledExactlyOnceWith();
  },
);

it.each([true, false])('routes unsent commands with code handler present: %s', (hasCodeHandler) => {
  connectRaw();
  const socket = getMockWebSocket();
  socket.readyState = WebSocket.CLOSED;
  const onError = vi.fn();
  const handler = vi.fn();
  getWebClient().protobuf.sendSessionCommand(Data.Command_Ping_ext, create(Data.Command_PingSchema), {
    onError, onResponseCode: hasCodeHandler ? { [Data.Response_ResponseCode.RespNotConnected]: handler } : {},
  });
  const raw = create(Data.ResponseSchema, { cmdId: 0n, responseCode: Data.Response_ResponseCode.RespNotConnected });
  expect(socket.send).not.toHaveBeenCalled();
  if (hasCodeHandler) {
    expect(handler).toHaveBeenCalledExactlyOnceWith(raw);
    expect(onError).not.toHaveBeenCalled();
  } else {
    expect(onError).toHaveBeenCalledExactlyOnceWith(Data.Response_ResponseCode.RespNotConnected, raw, CommandFailure.NotSent);
    expect(handler).not.toHaveBeenCalled();
  }
});

it('settles sibling commands when one reset callback throws', () => {
  connectRaw();
  const error = new Error('consumer failure');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const first = vi.fn(() => {
      throw error;
    });
    const second = vi.fn();
    const owner = getWebClient();
    owner.protobuf.sendSessionCommand(Data.Command_Ping_ext, create(Data.Command_PingSchema), { onError: first });
    const firstId = findLastSessionCommand(Data.Command_Ping_ext).cmdId;
    owner.protobuf.sendSessionCommand(Data.Command_Ping_ext, create(Data.Command_PingSchema), { onError: second });
    const secondId = findLastSessionCommand(Data.Command_Ping_ext).cmdId;
    owner.disconnect();
    for (const [callback, cmdId] of [[first, firstId], [second, secondId]] as const) {
      expect(callback).toHaveBeenCalledExactlyOnceWith(Data.Response_ResponseCode.RespNotConnected,
        create(Data.ResponseSchema, { cmdId: BigInt(cmdId), responseCode: Data.Response_ResponseCode.RespNotConnected }),
        CommandFailure.Disconnected);
    }
    expect(log).toHaveBeenCalledExactlyOnceWith('Command reset callback failed:', error);
  } finally {
    log.mockRestore();
  }
});

it('ignores late status, connect and probe requests after disposal', () => {
  connectRaw();
  const owner = getWebClient();
  const response = getMockResponse();
  const socket = getMockWebSocket();
  const close = socket.onclose!;
  expect(response.session.updateStatus).toHaveBeenCalledWith(StatusEnum.CONNECTED, 'Connected');
  WebClient.dispose();
  vi.mocked(response.session.updateStatus).mockClear();
  close();
  owner.connect(target);
  owner.testConnect(target);
  WebClient.dispose();
  expect(getMockWebSocket()).toBe(socket);
  expect(response.session.connectionAttempted).toHaveBeenCalledExactlyOnceWith();
  expect(response.session.updateStatus).not.toHaveBeenCalled();
  expect(owner.status).toBe(StatusEnum.DISCONNECTED);
  createWebClientForTest();
});

it.each([false, true])('handles reconnect settlement disposing owner: %s', (dispose) => {
  connectRaw();
  const owner = getWebClient();
  const response = getMockResponse();
  const socket = getMockWebSocket();
  const failure = vi.fn(() => {
    owner.connect(target);
    if (dispose) {
      WebClient.dispose();
    }
  });
  owner.protobuf.sendSessionCommand(Data.Command_Ping_ext, create(Data.Command_PingSchema), { onError: failure });
  const { cmdId, value } = findLastSessionCommand(Data.Command_Ping_ext);
  expect(value).toStrictEqual(create(Data.Command_PingSchema));
  owner.connect(target);
  expect(failure).toHaveBeenCalledExactlyOnceWith(Data.Response_ResponseCode.RespNotConnected,
    create(Data.ResponseSchema, { cmdId: BigInt(cmdId), responseCode: Data.Response_ResponseCode.RespNotConnected }),
    CommandFailure.Disconnected);
  if (dispose) {
    expect(getMockWebSocket()).toBe(socket);
    expect(response.session.connectionAttempted).toHaveBeenCalledTimes(1);
    expect(response.session.updateStatus).toHaveBeenLastCalledWith(StatusEnum.DISCONNECTED, 'Connection Closed');
    createWebClientForTest();
  } else {
    expect(getMockWebSocket()).not.toBe(socket);
    expect(response.session.connectionAttempted).toHaveBeenCalledTimes(2);
  }
});
