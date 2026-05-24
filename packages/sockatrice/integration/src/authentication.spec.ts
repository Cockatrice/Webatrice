// Authentication scenarios — login success/failure, register, activate,
// and the hashed-password (salt) login path.
//
// Diff from webclient: Redux state assertions are replaced with assertions
// on the response stub and on the WebClient's own `status` property.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import * as Data from '../../src/generated';
import { WebsocketTypes } from '../../src/types';

import {
  connectAndHandshake,
  connectAndHandshakeWithSalt,
  getMockResponse,
  getWebClient,
} from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

function makeUser(name: string): Data.ServerInfo_User {
  return create(Data.ServerInfo_UserSchema, {
    name,
    userLevel: Data.ServerInfo_User_UserLevelFlag.IsRegistered,
  });
}

describe('authentication', () => {
  describe('login', () => {
    it('drives LOGIN → LOGGED_IN and dispatches user info + buddy/ignore lists', () => {
      connectAndHandshake({ userName: 'alice' });

      const { cmdId, value } = findLastSessionCommand(Data.Command_Login_ext);
      expect(value.userName).toBe('alice');

      const loginPayload = create(Data.Response_LoginSchema, {
        userInfo: makeUser('alice'),
        buddyList: [makeUser('bob')],
        ignoreList: [makeUser('mallory')],
      });
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
        ext: Data.Response_Login_ext,
        value: loginPayload,
      })));

      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
      expect(getMockResponse().session.updateStatus).toHaveBeenCalledWith(
        WebsocketTypes.StatusEnum.LOGGED_IN,
        'Logged in.',
      );
      expect(getMockResponse().session.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'alice' }),
      );
      expect(getMockResponse().session.updateBuddyList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'bob' })]),
      );
      expect(getMockResponse().session.updateIgnoreList).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'mallory' })]),
      );

      expect(() => findLastSessionCommand(Data.Command_ListUsers_ext)).not.toThrow();
      expect(() => findLastSessionCommand(Data.Command_ListRooms_ext)).not.toThrow();
    });

    it('flips status to DISCONNECTED on RespWrongPassword', () => {
      connectAndHandshake();

      const { cmdId } = findLastSessionCommand(Data.Command_Login_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Data.Response_ResponseCode.RespWrongPassword,
      })));

      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(getMockResponse().session.loginFailed).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const registerOptions = {
      reason: WebsocketTypes.WebSocketConnectReason.REGISTER as const,
      host: 'localhost',
      port: '4748',
      userName: 'newbie',
      password: 'hunter2',
      email: 'newbie@example.com',
      country: 'US',
      realName: 'New Bie',
    };

    it('auto-logs-in on RespRegistrationAccepted', () => {
      connectAndHandshake(registerOptions);

      const register = findLastSessionCommand(Data.Command_Register_ext);
      expect(register.value.userName).toBe('newbie');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: register.cmdId,
        responseCode: Data.Response_ResponseCode.RespRegistrationAccepted,
      })));

      const login = findLastSessionCommand(Data.Command_Login_ext);
      expect(login.value.userName).toBe('newbie');
      expect(login.cmdId).toBeGreaterThan(register.cmdId);
    });

    it('parks registration in awaiting-activation on RespRegistrationAcceptedNeedsActivation', () => {
      connectAndHandshake(registerOptions);

      const register = findLastSessionCommand(Data.Command_Register_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: register.cmdId,
        responseCode: Data.Response_ResponseCode.RespRegistrationAcceptedNeedsActivation,
      })));

      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(getMockResponse().session.accountAwaitingActivation).toHaveBeenCalled();
      expect(() => findLastSessionCommand(Data.Command_Login_ext)).toThrow();
    });

    // Drive a registration attempt and feed back the given response code.
    function registerThenRespond(responseCode: Data.Response_ResponseCode): void {
      connectAndHandshake(registerOptions);
      const register = findLastSessionCommand(Data.Command_Register_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: register.cmdId,
        responseCode,
      })));
    }

    it('reports a taken username and disconnects on RespUserAlreadyExists', () => {
      registerThenRespond(Data.Response_ResponseCode.RespUserAlreadyExists);

      expect(getMockResponse().session.registrationUserNameError).toHaveBeenCalledWith('Username is taken');
      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
    });

    it('reports an invalid username on RespUsernameInvalid', () => {
      registerThenRespond(Data.Response_ResponseCode.RespUsernameInvalid);

      expect(getMockResponse().session.registrationUserNameError).toHaveBeenCalledWith('Invalid username');
    });

    it('reports a short password on RespPasswordTooShort', () => {
      registerThenRespond(Data.Response_ResponseCode.RespPasswordTooShort);

      expect(getMockResponse().session.registrationPasswordError).toHaveBeenCalledWith('Your password was too short');
    });

    it('requests an email on RespEmailRequiredToRegister', () => {
      registerThenRespond(Data.Response_ResponseCode.RespEmailRequiredToRegister);

      expect(getMockResponse().session.registrationRequiresEmail).toHaveBeenCalled();
    });

    it('reports a blocked email provider on RespEmailBlackListed', () => {
      registerThenRespond(Data.Response_ResponseCode.RespEmailBlackListed);

      expect(getMockResponse().session.registrationEmailError).toHaveBeenCalledWith('This email provider has been blocked');
    });

    it('reports the per-email account cap on RespTooManyRequests', () => {
      registerThenRespond(Data.Response_ResponseCode.RespTooManyRequests);

      expect(getMockResponse().session.registrationEmailError).toHaveBeenCalledWith('Max accounts reached for this email');
    });

    it('reports disabled registration on RespRegistrationDisabled', () => {
      registerThenRespond(Data.Response_ResponseCode.RespRegistrationDisabled);

      expect(getMockResponse().session.registrationFailed).toHaveBeenCalledWith('Registration is currently disabled');
    });

    it('surfaces the ban reason and end time on RespUserIsBanned', () => {
      connectAndHandshake(registerOptions);
      const register = findLastSessionCommand(Data.Command_Register_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: register.cmdId,
        responseCode: Data.Response_ResponseCode.RespUserIsBanned,
        ext: Data.Response_Register_ext,
        value: create(Data.Response_RegisterSchema, {
          deniedReasonStr: 'spamming',
          deniedEndTime: 1893456000n,
        }),
      })));

      expect(getMockResponse().session.registrationFailed).toHaveBeenCalledWith('spamming', 1893456000);
      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
    });

    it('reports a generic server issue on an unhandled error response', () => {
      registerThenRespond(Data.Response_ResponseCode.RespInternalError);

      expect(getMockResponse().session.registrationFailed).toHaveBeenCalledWith('Registration failed due to a server issue');
      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
    });
  });

  describe('activate', () => {
    it('auto-logs-in on RespActivationAccepted', () => {
      connectAndHandshake({
        reason: WebsocketTypes.WebSocketConnectReason.ACTIVATE_ACCOUNT as const,
        host: 'localhost',
        port: '4748',
        userName: 'alice',
        token: 'abc-123',
        password: 'secret',
      });

      const activate = findLastSessionCommand(Data.Command_Activate_ext);
      expect(activate.value.userName).toBe('alice');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: activate.cmdId,
        responseCode: Data.Response_ResponseCode.RespActivationAccepted,
      })));

      const login = findLastSessionCommand(Data.Command_Login_ext);
      expect(login.value.userName).toBe('alice');
    });
  });

  describe('hashed-password login (salt path)', () => {
    it('requests salt then sends login with hashedPassword instead of plaintext', async () => {
      connectAndHandshakeWithSalt({ userName: 'alice', password: 'secret' });

      const salt = findLastSessionCommand(Data.Command_RequestPasswordSalt_ext);
      expect(salt.value.userName).toBe('alice');
      expect(() => findLastSessionCommand(Data.Command_Login_ext)).toThrow();

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: salt.cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
        ext: Data.Response_PasswordSalt_ext,
        value: create(Data.Response_PasswordSaltSchema, { passwordSalt: 'test-salt-value' }),
      })));

      // hashPassword is async (1000 SHA-512 rounds via crypto.subtle), so the
      // Command_Login is dispatched on a later microtask. Wait for it — with a
      // generous timeout so the real crypto work doesn't flake under the CPU
      // contention of a full parallel test run.
      const login = await vi.waitFor(
        () => findLastSessionCommand(Data.Command_Login_ext),
        { timeout: 5000, interval: 25 },
      );
      expect(login.value.userName).toBe('alice');
      expect(login.value.hashedPassword).toBeTruthy();
      expect(login.value.password).toBeFalsy();

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: login.cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
        ext: Data.Response_Login_ext,
        value: create(Data.Response_LoginSchema, {
          userInfo: makeUser('alice'),
          buddyList: [],
          ignoreList: [],
        }),
      })));

      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
    });

    it('disconnects and fails over when the salt request needs registration', () => {
      connectAndHandshakeWithSalt({ userName: 'alice', password: 'secret' });

      const salt = findLastSessionCommand(Data.Command_RequestPasswordSalt_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: salt.cmdId,
        responseCode: Data.Response_ResponseCode.RespRegistrationRequired,
      })));

      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(getMockResponse().session.updateStatus).toHaveBeenCalledWith(
        WebsocketTypes.StatusEnum.DISCONNECTED,
        'Login failed: registration required',
      );
      expect(() => findLastSessionCommand(Data.Command_Login_ext)).toThrow();
    });

    it('disconnects on an unexpected salt-request error', () => {
      connectAndHandshakeWithSalt({ userName: 'alice', password: 'secret' });

      const salt = findLastSessionCommand(Data.Command_RequestPasswordSalt_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: salt.cmdId,
        responseCode: Data.Response_ResponseCode.RespWrongPassword,
      })));

      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(getMockResponse().session.updateStatus).toHaveBeenCalledWith(
        WebsocketTypes.StatusEnum.DISCONNECTED,
        'Login failed: Unknown Reason',
      );
      expect(() => findLastSessionCommand(Data.Command_Login_ext)).toThrow();
    });
  });
});
