import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import { Command_ForgotPasswordChallenge_ext, Command_ForgotPasswordRequest_ext, Command_ForgotPasswordReset_ext, Response_ForgotPasswordRequestSchema, Response_ForgotPasswordRequest_ext, Response_ResponseCode } from 'sockatrice/generated';
import { store } from '../helpers/setup';
import { WebsocketTypes } from 'sockatrice/types';

import { connectAndHandshake } from '../helpers/setup';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../helpers/protobuf-builders';
import { findLastSessionCommand } from '../helpers/command-capture';

describe('password reset', () => {
  it('forgotPasswordRequest sends command and disconnects on success', () => {
    connectAndHandshake({
      reason: WebsocketTypes.WebSocketConnectReason.PASSWORD_RESET_REQUEST as const,
      host: 'localhost',
      port: '4748',
      userName: 'alice',
    });

    const req = findLastSessionCommand(Command_ForgotPasswordRequest_ext);
    expect(req.value.userName).toBe('alice');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: req.cmdId,
      responseCode: Response_ResponseCode.RespOk,
      ext: Response_ForgotPasswordRequest_ext,
      value: create(Response_ForgotPasswordRequestSchema, {
        challengeEmail: 'a@example.com',
      }),
    })));

    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });

  it('forgotPasswordChallenge sends command with userName and email', () => {
    connectAndHandshake({
      reason: WebsocketTypes.WebSocketConnectReason.PASSWORD_RESET_CHALLENGE as const,
      host: 'localhost',
      port: '4748',
      userName: 'alice',
      email: 'alice@example.com',
    });

    const challenge = findLastSessionCommand(Command_ForgotPasswordChallenge_ext);
    expect(challenge.value.userName).toBe('alice');
    expect(challenge.value.email).toBe('alice@example.com');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: challenge.cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
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

    const reset = findLastSessionCommand(Command_ForgotPasswordReset_ext);
    expect(reset.value.userName).toBe('alice');
    expect(reset.value.token).toBe('reset-token-123');
    expect(reset.value.newPassword).toBe('new-secret');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: reset.cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });
});