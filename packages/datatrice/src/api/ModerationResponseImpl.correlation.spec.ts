import { create } from '@bufbuild/protobuf';
import type { Store } from '@reduxjs/toolkit';
import { Response_WarnListSchema, ServerInfo_UserSchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { AdminResponseImpl } from './AdminResponseImpl';
import { ModeratorResponseImpl } from './ModeratorResponseImpl';
import { SessionResponseImpl } from './SessionResponseImpl';
import { Actions } from '../store/server/server.actions';
import { serverReducer } from '../store/server/server.reducer';

function setup() {
  const dispatch = vi.fn();
  const store = { dispatch } as unknown as Store;
  return {
    dispatch, admin: new AdminResponseImpl(store), moderator: new ModeratorResponseImpl(store), session: new SessionResponseImpl(store),
  };
}

it('carries each successful query identity on the action without adding it to domain state', () => {
  const { dispatch, moderator, admin, session } = setup();
  const userInfo = create(ServerInfo_UserSchema, { name: 'alice' });
  const warnList = [create(Response_WarnListSchema, { userName: 'alice', warning: ['Reason'] })];
  const checks = [
    { send: () => moderator.banHistory('alice', [], 'ban'),
      action: Actions.banHistory({ userName: 'alice', banHistory: [], requestId: 'ban' }) },
    { send: () => moderator.warnHistory('alice', [], 'warn'),
      action: Actions.warnHistory({ userName: 'alice', warnHistory: [], requestId: 'warn' }) },
    { send: () => moderator.getAdminNotes('alice', 'private', 'notes'),
      action: Actions.getAdminNotes({ userName: 'alice', notes: 'private', requestId: 'notes' }) },
    { send: () => moderator.warnListOptions(warnList, 'list'), action: Actions.warnListOptions({ warnList, requestId: 'list' }) },
    { send: () => moderator.viewLogs([], 'logs'), action: Actions.viewLogs({ logs: [], requestId: 'logs' }) },
    { send: () => admin.adjustMod('alice', true, undefined, undefined, 'role'),
      action: Actions.adjustMod({ userName: 'alice', shouldBeMod: true, requestId: 'role' }) },
    { send: () => session.getUserInfo(userInfo, 'user'), action: Actions.getUserInfo({ userInfo, requestId: 'user' }) },
  ];
  for (const { send, action } of checks) {
    send();
    expect(dispatch).toHaveBeenLastCalledWith(action);
    expect(JSON.stringify(serverReducer(undefined, action))).not.toContain('"requestId"');
  }
});

it.each([undefined, ...Object.values(WebsocketTypes.CommandFailure)])('carries failure identity with reason %s', (failure) => {
  const { dispatch, moderator, admin, session } = setup();
  moderator.commandFailed('banHistory', 3, 'alice', failure, 'history');
  expect(dispatch).toHaveBeenLastCalledWith(Actions.moderatorCommandFailed({
    command: 'banHistory', responseCode: 3, target: 'alice', failure, requestId: 'history',
  }));
  admin.commandFailed('adjustMod', 3, 'alice', failure, 'role');
  expect(dispatch).toHaveBeenLastCalledWith(Actions.adminCommandFailed({
    command: 'adjustMod', responseCode: 3, target: 'alice', failure, requestId: 'role',
  }));
  session.getUserInfoFailed('alice', 3, 'user');
  expect(dispatch).toHaveBeenLastCalledWith(Actions.getUserInfoFailed({ userName: 'alice', responseCode: 3, requestId: 'user' }));
});

it('keeps existing callers without identities valid', () => {
  const { dispatch, moderator, admin, session } = setup();
  moderator.getAdminNotes('alice', 'notes');
  expect(dispatch).toHaveBeenLastCalledWith(Actions.getAdminNotes({ userName: 'alice', notes: 'notes' }));
  admin.adjustMod('alice', undefined, false);
  expect(dispatch).toHaveBeenLastCalledWith(Actions.adjustMod({ userName: 'alice', shouldBeJudge: false }));
  session.getUserInfoFailed('alice', 3);
  expect(dispatch).toHaveBeenLastCalledWith(Actions.getUserInfoFailed({ userName: 'alice', responseCode: 3 }));
});
