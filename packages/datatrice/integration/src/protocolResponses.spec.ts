import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import * as Data from '@cockatrice/sockatrice/generated';
import { attachResponseHandlers, createStore, server } from '../../src';

describe('protocol 3.1 response bridge', () => {
  it.each([
    ['3.1.0-1', false],
    ['3.1.0-alpha', false],
    ['3.1.0-rc', true],
    ['3.1.0-beta.preview', true],
    ['3.1.0-beta', false],
    ['3.1.0-beta.7', false],
    ['3.1.0-beta.8', true],
    ['3.1.0', true],
    ['3.1.1', true],
    ['3.2.0', true],
    ['4.0.0', true],
    ['3.0.0', false],
    ['custom', false],
  ])('server identification %s gates reports through the store selector', (version, expected) => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    expect(server.Selectors.supports(store.getState(), server.ServerCapability.REPORTS)).toBe(false);
    response.session.updateInfo('Test server', version);
    expect(server.Selectors.getVersion(store.getState())).toBe(version);
    expect(server.Selectors.supports(store.getState(), server.ServerCapability.REPORTS)).toBe(expected);
  });

  it('preserves a login rejection across disconnects and clears it on retry', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    expect(server.Selectors.getLoginFailureCode(store.getState())).toBeNull();
    response.session.loginFailed(Data.Response_ResponseCode.RespServerFull);
    response.session.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'Server full');
    expect(server.Selectors.getLoginFailureCode(store.getState())).toBe(Data.Response_ResponseCode.RespServerFull);
    response.session.connectionAttempted();
    expect(server.Selectors.getLoginFailureCode(store.getState())).toBeNull();
  });

  it('clears a stored login rejection when a failure arrives without a code', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.loginFailed(Data.Response_ResponseCode.RespWrongPassword);
    expect(server.Selectors.getLoginFailureCode(store.getState())).toBe(Data.Response_ResponseCode.RespWrongPassword);
    response.session.loginFailed();
    expect(server.Selectors.getLoginFailureCode(store.getState())).toBeNull();
  });

  it('detects the developer role after user responses without confusing it with moderator', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    expect(server.Selectors.getIsUserDeveloper(store.getState())).toBe(false);
    response.session.updateUser(create(Data.ServerInfo_UserSchema, {
      name: 'alice', userLevel: Data.ServerInfo_User_UserLevelFlag.IsDeveloper
    }));
    expect(server.Selectors.getIsUserDeveloper(store.getState())).toBe(true);
    expect(server.Selectors.getIsUserModerator(store.getState())).toBe(false);
    response.session.updateUser(create(Data.ServerInfo_UserSchema, {
      name: 'alice', userLevel: Data.ServerInfo_User_UserLevelFlag.IsModerator
    }));
    expect(server.Selectors.getIsUserDeveloper(store.getState())).toBe(false);
    expect(server.Selectors.getIsUserModerator(store.getState())).toBe(true);
  });

  it('dispatches query failures with the scope, code and target intact', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const dispatch = vi.spyOn(store, 'dispatch');
    response.session.commandFailed!('deckShareList', Data.Response_ResponseCode.RespNameNotFound, 'missing-token');
    expect(dispatch).toHaveBeenLastCalledWith(server.Actions.sessionCommandFailed({
      command: 'deckShareList', responseCode: Data.Response_ResponseCode.RespNameNotFound, target: 'missing-token',
    }));
    response.moderator.commandFailed!('reportUserInfo', Data.Response_ResponseCode.RespAccessDenied, 'alice');
    expect(dispatch).toHaveBeenLastCalledWith(server.Actions.moderatorCommandFailed({
      command: 'reportUserInfo', responseCode: Data.Response_ResponseCode.RespAccessDenied, target: 'alice',
    }));
  });

  it('changes only explicitly supplied staff roles through the admin bridge', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const flags = Data.ServerInfo_User_UserLevelFlag;
    response.session.updateUsers([create(Data.ServerInfo_UserSchema, {
      name: 'alice', userLevel: flags.IsModerator | flags.IsJudge,
    })]);
    response.admin.adjustMod('alice', undefined, undefined, true);
    expect(server.Selectors.getUsers(store.getState()).alice.userLevel).toBe(flags.IsModerator | flags.IsJudge | flags.IsDeveloper);
    response.admin.adjustMod('alice', undefined, false, false);
    expect(server.Selectors.getUsers(store.getState()).alice.userLevel).toBe(flags.IsModerator);
  });
});
