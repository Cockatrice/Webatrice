// Password-reset scenarios — the 3-step forgot-password flow. Each step
// is a separate connect → handshake → command → disconnect cycle.

import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { WebsocketTypes } from '../../src/types';

import { connectAndHandshake, getWebClient } from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

describe('password reset', () => {
  it('forgotPasswordRequest sends command', () => {
    connectAndHandshake({
      reason: WebsocketTypes.WebSocketConnectReason.PASSWORD_RESET_REQUEST as const,
      host: 'localhost',
      port: '4748',
      userName: 'alice',
    });

    const req = findLastSessionCommand(Data.Command_ForgotPasswordRequest_ext);
    expect(req.value.userName).toBe('alice');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: req.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });

  it('forgotPasswordChallenge sends command with userName and email', () => {
    connectAndHandshake({
      reason: WebsocketTypes.WebSocketConnectReason.PASSWORD_RESET_CHALLENGE as const,
      host: 'localhost',
      port: '4748',
      userName: 'alice',
      email: 'alice@example.com',
    });

    const challenge = findLastSessionCommand(Data.Command_ForgotPasswordChallenge_ext);
    expect(challenge.value.userName).toBe('alice');
    expect(challenge.value.email).toBe('alice@example.com');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: challenge.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });

  it('forgotPasswordReset sends command with userName, token, and newPassword', () => {
    connectAndHandshake({
      reason: WebsocketTypes.WebSocketConnectReason.PASSWORD_RESET as const,
      host: 'localhost',
      port: '4748',
      userName: 'alice',
      token: 'reset-token-123',
      newPassword: 'new-secret',
    });

    const reset = findLastSessionCommand(Data.Command_ForgotPasswordReset_ext);
    expect(reset.value.userName).toBe('alice');
    expect(reset.value.token).toBe('reset-token-123');
    expect(reset.value.newPassword).toBe('new-secret');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: reset.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });
});
