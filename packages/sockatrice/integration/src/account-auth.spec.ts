import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi, type Mock } from 'vitest';
import * as Data from '../../src/generated';
import { DeveloperCommands, SessionCommands } from '../../src';
import { WebsocketTypes } from '../../src/types';
import { DEFAULT_COMMAND_TIMEOUT_MS } from '../../src/services/ProtobufService';
import {
  connectAndLogin, connectAndHandshake, connectAndHandshakeWithSalt, getMockResponse, getMockWebSocket, getWebClient,
} from '../../src/testing/setup';
import { findLastSessionCommand, findLastDeveloperCommand } from '../../src/testing/command-capture';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import * as utils from '../../src/utils';

function answer(cmdId: number, responseCode = Data.Response_ResponseCode.RespOk) {
  deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
}

const HASHED_NEW_PASSWORD =
  '0123456789ABCDEFMwXse5RrB8LYe/ai+yqnkkiKcv1i5klxE3dpFB0myIwFmDGN2rXGMBFtKajeiSaqNm26yFaVcMv2HGYHdDDDJQ==';

describe('account command outcomes', () => {
  it.each(['secret', ''])('preserves legacy profile fields with password %j', (password) => {
    connectAndLogin();
    SessionCommands.accountEdit(password, 'Alice', 'alice@example.com', 'AU');
    const { value, cmdId } = findLastSessionCommand(Data.Command_AccountEdit_ext);
    expect({ ...value }).toEqual({
      $typeName: value.$typeName, realName: 'Alice', email: 'alice@example.com', country: 'AU',
      ...(password ? { passwordCheck: password } : {}),
    });
    answer(cmdId);
    expect(getMockResponse().session.accountEditChanged).toHaveBeenCalledExactlyOnceWith('Alice', 'alice@example.com', 'AU');
  });

  it('sends only supplied profile fields and reports success to both consumers', () => {
    connectAndLogin();
    const onEdited = vi.fn();
    const onFailure = vi.fn();
    SessionCommands.accountEdit({ realName: '', country: 'NZ' }, onEdited, onFailure);
    const { value, cmdId } = findLastSessionCommand(Data.Command_AccountEdit_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, realName: '', country: 'NZ' });
    answer(cmdId);
    expect(getMockResponse().session.accountEditChanged).toHaveBeenCalledExactlyOnceWith('', undefined, 'NZ');
    expect(onEdited).toHaveBeenCalledExactlyOnceWith();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it.each([true, false])('replaces or removes an avatar with caller callback %s', (withCallback) => {
    connectAndLogin();
    const image = withCallback ? new Uint8Array([1, 2, 3]) : new Uint8Array();
    const onChanged = vi.fn();
    SessionCommands.accountImage(image, withCallback ? onChanged : undefined);
    const { value, cmdId } = findLastSessionCommand(Data.Command_AccountImage_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, image });
    answer(cmdId);
    expect(getMockResponse().session.accountImageChanged).toHaveBeenCalledExactlyOnceWith(image);
    if (withCallback) {
      expect(onChanged).toHaveBeenCalledExactlyOnceWith();
    }
  });

  it.each([false, true])('selects the advertised password format: hashing %s', async (hashed) => {
    connectAndLogin();
    getWebClient().serverSupportsPasswordHash = hashed;
    const salt = vi.spyOn(utils, 'generateSalt').mockReturnValue('0123456789ABCDEF');
    const onChanged = vi.fn();
    const onFailure = vi.fn();
    try {
      await SessionCommands.accountPassword('old', 'new', onChanged, onFailure);
      const { value, cmdId } = findLastSessionCommand(Data.Command_AccountPassword_ext);
      expect({ ...value }).toEqual({
        $typeName: value.$typeName, oldPassword: 'old',
        ...(hashed ? { hashedNewPassword: HASHED_NEW_PASSWORD } : { newPassword: 'new' }),
      });
      expect(salt).toHaveBeenCalledTimes(hashed ? 1 : 0);
      answer(cmdId);
      expect(getMockResponse().session.accountPasswordChange).toHaveBeenCalledExactlyOnceWith();
      expect(onChanged).toHaveBeenCalledExactlyOnceWith();
      expect(onFailure).not.toHaveBeenCalled();
    } finally {
      salt.mockRestore();
    }
  });

  it.each([['new', ''], ['', 'callerHash']])('preserves legacy password credentials %j / %j', (password, hash) => {
    connectAndLogin();
    expect(SessionCommands.accountPassword('old', password, hash)).toBeUndefined();
    const { value, cmdId } = findLastSessionCommand(Data.Command_AccountPassword_ext);
    expect({ ...value }).toEqual({
      $typeName: value.$typeName, oldPassword: 'old',
      ...(password ? { newPassword: password } : {}), ...(hash ? { hashedNewPassword: hash } : {}),
    });
    answer(cmdId);
    expect(getMockResponse().session.accountPasswordChange).toHaveBeenCalledExactlyOnceWith();
  });

  it.each(['edit', 'image', 'password'] as const)('%s forwards rejection and timeout without publishing success', async (command) => {
    connectAndLogin();
    const onChanged = vi.fn();
    const onFailure = vi.fn();
    const send = async () => {
      if (command === 'edit') {
        SessionCommands.accountEdit({ email: 'new@example.com', passwordCheck: 'old' }, onChanged, onFailure);
        return findLastSessionCommand(Data.Command_AccountEdit_ext).cmdId;
      }
      if (command === 'image') {
        SessionCommands.accountImage(new Uint8Array(), onChanged, onFailure);
        return findLastSessionCommand(Data.Command_AccountImage_ext).cmdId;
      }
      await SessionCommands.accountPassword('old', 'new', onChanged, onFailure);
      return findLastSessionCommand(Data.Command_AccountPassword_ext).cmdId;
    };
    answer(await send(), Data.Response_ResponseCode.RespFunctionNotAllowed);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(Data.Response_ResponseCode.RespFunctionNotAllowed, undefined);
    const cmdId = await send();
    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(onFailure.mock.calls).toEqual([
      [Data.Response_ResponseCode.RespFunctionNotAllowed, undefined],
      [Data.Response_ResponseCode.RespNotConnected, WebsocketTypes.CommandFailure.Timeout],
    ]);
    answer(cmdId);
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onChanged).not.toHaveBeenCalled();
    expect(getMockResponse().session.accountEditChanged).not.toHaveBeenCalled();
    expect(getMockResponse().session.accountImageChanged).not.toHaveBeenCalled();
    expect(getMockResponse().session.accountPasswordChange).not.toHaveBeenCalled();
  });
});

describe('developer log correlation', () => {
  it.each([undefined, 'request-10'])('echoes request %j on success and rejection', (requestId) => {
    connectAndLogin();
    const correlation: [string?] = requestId === undefined ? [] : [requestId];
    const filters = requestId === undefined ? { dateRange: 1 } : { dateRange: 1, userName: 'alice' };
    DeveloperCommands.viewLogHistory(filters, ...correlation);
    const { value, cmdId } = findLastDeveloperCommand(Data.Command_ViewLogHistory_dev_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, logLocation: [], ...filters });
    const logMessage = [create(Data.ServerInfo_ChatMessageSchema, { senderName: 'alice', message: 'hello' })];
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ViewLogHistory_ext, value: create(Data.Response_ViewLogHistorySchema, { logMessage }),
    })));
    expect(getMockResponse().moderator.viewLogs).toHaveBeenCalledExactlyOnceWith(logMessage, ...correlation);
    DeveloperCommands.viewLogHistory(filters, ...correlation);
    answer(findLastDeveloperCommand(Data.Command_ViewLogHistory_dev_ext).cmdId, Data.Response_ResponseCode.RespFunctionNotAllowed);
    expect(getMockResponse().moderator.commandFailed).toHaveBeenCalledExactlyOnceWith(
      'viewLogHistory', Data.Response_ResponseCode.RespFunctionNotAllowed,
      requestId === undefined ? '' : 'alice', undefined, ...correlation,
    );
    expect(getMockResponse().moderator.viewLogs).toHaveBeenCalledTimes(1);
  });
});

describe('activation failures', () => {
  it.each(['rejection', 'timeout', 'disconnect'] as const)('settles activation after %s', (outcome) => {
    connectAndHandshake({ reason: WebsocketTypes.WebSocketConnectReason.ACTIVATE_ACCOUNT, userName: 'alice', token: 'token' });
    const { cmdId } = findLastSessionCommand(Data.Command_Activate_ext);
    if (outcome === 'rejection') {
      answer(cmdId, Data.Response_ResponseCode.RespFunctionNotAllowed);
    } else if (outcome === 'timeout') {
      vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    } else {
      getMockWebSocket().readyState = 3;
      getMockWebSocket().onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);
    }
    expect(getMockResponse().session.accountActivationFailed).toHaveBeenCalledExactlyOnceWith(
      outcome === 'rejection' ? undefined
        : outcome === 'timeout' ? WebsocketTypes.CommandFailure.Timeout : WebsocketTypes.CommandFailure.Disconnected,
    );
    expect(getMockResponse().session.accountActivationSuccess).not.toHaveBeenCalled();
    if (outcome === 'disconnect') {
      expect(getMockResponse().session.updateStatus).not.toHaveBeenCalledWith(
        WebsocketTypes.StatusEnum.DISCONNECTED, 'Account Activation Failed',
      );
      expect(getMockWebSocket().close).not.toHaveBeenCalled();
    } else {
      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(getMockWebSocket().close).toHaveBeenCalledTimes(1);
    }
  });

  it.each(['timeout', 'disconnect'] as const)('forwards activation salt %s and preserves reconnect on a lost socket', (outcome) => {
    connectAndHandshakeWithSalt({
      reason: WebsocketTypes.WebSocketConnectReason.ACTIVATE_ACCOUNT, userName: 'alice', password: 'pw', token: 'token',
    });
    expect(getWebClient().serverSupportsPasswordHash).toBe(true);
    expect(getMockResponse().session.updateInfo).toHaveBeenCalledExactlyOnceWith('TestServer', '2.8.0', true);
    const { value } = findLastSessionCommand(Data.Command_RequestPasswordSalt_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, userName: 'alice' });
    const sockets = (globalThis.WebSocket as unknown as Mock).mock.calls.length;
    if (outcome === 'timeout') {
      vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    } else {
      getMockWebSocket().readyState = 3;
      getMockWebSocket().onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);
    }
    expect(getMockResponse().session.accountActivationFailed).toHaveBeenCalledExactlyOnceWith(
      outcome === 'timeout' ? WebsocketTypes.CommandFailure.Timeout : WebsocketTypes.CommandFailure.Disconnected,
    );
    expect(() => findLastSessionCommand(Data.Command_Activate_ext)).toThrow();
    if (outcome === 'disconnect') {
      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.RECONNECTING);
      vi.advanceTimersByTime(1000);
      expect((globalThis.WebSocket as unknown as Mock).mock.calls.length).toBe(sockets + 1);
    } else {
      expect(getMockWebSocket().close).toHaveBeenCalledTimes(1);
    }
  });
});
