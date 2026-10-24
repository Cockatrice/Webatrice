import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import {
  Response_ReportUserInfoSchema,
  ServerInfo_UserAltSchema,
  ServerInfo_UserSessionSchema,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import { attachResponseHandlers, createStore, server } from '../../src';

const info = create(Response_ReportUserInfoSchema, { userName: 'alice', adminNotes: 'private note' });
const alts = [create(ServerInfo_UserAltSchema, { userName: 'alt', email: 'private@example.test' })];
const sessions = [create(ServerInfo_UserSessionSchema, { ipAddress: '192.0.2.7' })];

it.each(['none', 'different'] as const)('drops private responses when the active investigation is %s', (active) => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  if (active === 'different') {
    store.dispatch(server.Actions.userInvestigationStarted({ userName: 'bob' }));
    response.moderator.userAlts!('bob', alts);
  }
  const expected = active === 'different' ? { userName: 'bob', results: { alts } } : null;
  expect(store.getState().server.staff.investigation).toEqual(expected);
  const dispatch = vi.spyOn(store, 'dispatch');
  try {
    response.moderator.reportUserInfo!(info);
    response.moderator.userAlts!('alice', alts);
    response.moderator.userSessions!('alice', sessions);
    expect(dispatch.mock.calls).toEqual([]);
    expect(store.getState().server.staff.investigation).toEqual(expected);
    expect(server.Selectors.getUserInvestigation(store.getState(), 'alice')).toBeUndefined();
  } finally {
    dispatch.mockRestore();
  }
});

it('dispatches all active investigation responses with their complete payloads', () => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  store.dispatch(server.Actions.userInvestigationStarted({ userName: 'alice' }));
  const dispatch = vi.spyOn(store, 'dispatch');
  try {
    response.moderator.reportUserInfo!(info);
    response.moderator.userAlts!('alice', alts);
    response.moderator.userSessions!('alice', sessions);
    expect(dispatch.mock.calls).toEqual([
      [server.Actions.userInfoReport({ info })],
      [server.Actions.userAlts({ userName: 'alice', alts })],
      [server.Actions.userSessions({ userName: 'alice', sessions })],
    ]);
    expect(store.getState().server.staff.investigation).toEqual({ userName: 'alice', results: { info, alts, sessions } });
  } finally {
    dispatch.mockRestore();
  }
});

it.each(['none', 'different'] as const)('rejects stale dispatched results when the active investigation is %s', (active) => {
  const store = createStore();
  const bobAlts = [create(ServerInfo_UserAltSchema, { userName: 'bob-alt', email: 'bob@example.test' })];
  if (active === 'different') {
    store.dispatch(server.Actions.userInvestigationStarted({ userName: 'bob' }));
    store.dispatch(server.Actions.userAlts({ userName: 'bob', alts: bobAlts }));
  }
  const expected = active === 'different' ? { userName: 'bob', results: { alts: bobAlts } } : null;
  expect(store.getState().server.staff.investigation).toEqual(expected);
  for (const action of [
    server.Actions.userInfoReport({ info }),
    server.Actions.userAlts({ userName: 'alice', alts }),
    server.Actions.userSessions({ userName: 'alice', sessions }),
  ]) {
    store.dispatch(action);
    expect(store.getState().server.staff.investigation).toEqual(expected);
  }
});

it.each([undefined, WebsocketTypes.CommandFailure.Disconnected])('dispatches the developer failure reason %s', (failure) => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  const dispatch = vi.spyOn(store, 'dispatch');
  try {
    response.developer!.commandFailed!('getServerStats', 8, 'target', failure);
    expect(dispatch.mock.calls).toEqual([
      [server.Actions.developerCommandFailed({ command: 'getServerStats', responseCode: 8, target: 'target', failure })],
    ]);
  } finally {
    dispatch.mockRestore();
  }
});

it('removes the online avatar without creating a missing profile or changing another user', () => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  const alice = create(ServerInfo_UserSchema, { name: 'alice', avatarBmp: new Uint8Array([1, 2]), userLevel: 4 });
  const bob = create(ServerInfo_UserSchema, { name: 'bob', avatarBmp: new Uint8Array([3]) });
  response.session.updateUsers([alice, bob]);
  expect(store.getState().server.users.alice.avatarBmp).toEqual(new Uint8Array([1, 2]));
  expect(store.getState().server.userInfo.alice).toBeUndefined();
  response.moderator.userAvatarRemoved!('alice');
  expect(store.getState().server.users.alice).toEqual(create(ServerInfo_UserSchema, {
    name: 'alice', avatarBmp: new Uint8Array(), userLevel: 4,
  }));
  expect(store.getState().server.users.alice).not.toBe(alice);
  expect(store.getState().server.users.bob).toEqual(bob);
  expect(store.getState().server.userInfo.alice).toBeUndefined();
  expect(alice.avatarBmp).toEqual(new Uint8Array([1, 2]));
});
