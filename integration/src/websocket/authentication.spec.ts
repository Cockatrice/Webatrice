import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import { Command_Activate_ext, Command_ListRooms_ext, Command_ListUsers_ext, Command_Login_ext, Command_Register_ext, Command_RequestPasswordSalt_ext, Response_LoginSchema, Response_Login_ext, Response_PasswordSaltSchema, Response_PasswordSalt_ext, Response_ResponseCode, ServerInfo_User, ServerInfo_UserSchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { store } from '../helpers/setup';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { connectAndHandshake, connectAndHandshakeWithSalt } from '../helpers/setup';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../helpers/protobuf-builders';
import { findLastSessionCommand } from '../helpers/command-capture';

function makeUser(name: string): ServerInfo_User {
  return create(ServerInfo_UserSchema, {
    name,
    userLevel: ServerInfo_User_UserLevelFlag.IsRegistered,
  });
}

describe('authentication', () => {
  describe('login', () => {
    it('drives LOGIN → LOGGED_IN and populates user info + buddy/ignore lists', () => {
      connectAndHandshake({ userName: 'alice' });

      const { cmdId, value } = findLastSessionCommand(Command_Login_ext);
      expect(value.userName).toBe('alice');

      const loginPayload = create(Response_LoginSchema, {
        userInfo: makeUser('alice'),
        buddyList: [makeUser('bob')],
        ignoreList: [makeUser('mallory')],
      });
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Response_ResponseCode.RespOk,
        ext: Response_Login_ext,
        value: loginPayload,
      })));

      const state = store.getState().server;
      expect(state.status.state).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
      expect(state.status.description).toBe('Logged in.');
      expect(state.user?.name).toBe('alice');
      expect(Object.keys(state.buddyList)).toEqual(['bob']);
      expect(Object.keys(state.ignoreList)).toEqual(['mallory']);

      expect(() => findLastSessionCommand(Command_ListUsers_ext)).not.toThrow();
      expect(() => findLastSessionCommand(Command_ListRooms_ext)).not.toThrow();
    });

    it('flips status to DISCONNECTED on RespWrongPassword', () => {
      connectAndHandshake();

      const { cmdId } = findLastSessionCommand(Command_Login_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Response_ResponseCode.RespWrongPassword,
      })));

      const state = store.getState().server;
      expect(state.status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(state.user).toBeNull();
      expect(state.buddyList).toEqual({});
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

      const register = findLastSessionCommand(Command_Register_ext);
      expect(register.value.userName).toBe('newbie');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: register.cmdId,
        responseCode: Response_ResponseCode.RespRegistrationAccepted,
      })));

      const login = findLastSessionCommand(Command_Login_ext);
      expect(login.value.userName).toBe('newbie');
      expect(login.cmdId).toBeGreaterThan(register.cmdId);
    });

    it('parks registration in awaiting-activation on RespRegistrationAcceptedNeedsActivation', () => {
      connectAndHandshake(registerOptions);

      const register = findLastSessionCommand(Command_Register_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: register.cmdId,
        responseCode: Response_ResponseCode.RespRegistrationAcceptedNeedsActivation,
      })));

      expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(() => findLastSessionCommand(Command_Login_ext)).toThrow();
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

      const activate = findLastSessionCommand(Command_Activate_ext);
      expect(activate.value.userName).toBe('alice');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: activate.cmdId,
        responseCode: Response_ResponseCode.RespActivationAccepted,
      })));

      const login = findLastSessionCommand(Command_Login_ext);
      expect(login.value.userName).toBe('alice');
    });
  });

  describe('hashed-password login (salt path)', () => {
    it('requests salt then sends login with hashedPassword instead of plaintext', async () => {
      // Switch off the harness's fake timers for this test. hashPassword loops 1000
      // awaits of `crypto.subtle.digest('SHA-512', …)` — purely microtask-driven.
      // Fake timers don't touch microtasks, so vi.waitFor's poll cap races the hash
      // chain on slow hosts. Real timers + a generous waitFor timeout makes the
      // crypto completion deterministic. afterEach unconditionally calls
      // useRealTimers, so no restore is needed.
      vi.useRealTimers();

      connectAndHandshakeWithSalt({ userName: 'alice', password: 'secret' });

      // First command should be RequestPasswordSalt, not Login
      const salt = findLastSessionCommand(Command_RequestPasswordSalt_ext);
      expect(salt.value.userName).toBe('alice');
      expect(() => findLastSessionCommand(Command_Login_ext)).toThrow();

      // Deliver salt response
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: salt.cmdId,
        responseCode: Response_ResponseCode.RespOk,
        ext: Response_PasswordSalt_ext,
        value: create(Response_PasswordSaltSchema, { passwordSalt: 'test-salt-value' }),
      })));

      // hashPassword (1000 SHA-512 rounds) completes its microtask chain then
      // dispatches Command_Login. Allow 30s; the microtask budget tightens
      // sharply under full-suite load when the thread pool is saturated.
      await vi.waitFor(() => findLastSessionCommand(Command_Login_ext), { timeout: 30000 });

      // Now login should have been sent with hashedPassword
      const login = findLastSessionCommand(Command_Login_ext);
      expect(login.value.userName).toBe('alice');
      expect(login.value.hashedPassword).toBeTruthy();
      expect(login.value.password).toBeFalsy();

      // Complete login
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: login.cmdId,
        responseCode: Response_ResponseCode.RespOk,
        ext: Response_Login_ext,
        value: create(Response_LoginSchema, {
          userInfo: makeUser('alice'),
          buddyList: [],
          ignoreList: [],
        }),
      })));

      expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
    });
  });
});
