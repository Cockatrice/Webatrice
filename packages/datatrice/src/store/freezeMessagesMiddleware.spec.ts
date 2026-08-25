import { clone, create } from '@bufbuild/protobuf';
import { ServerInfo_RoomSchema, ServerInfo_UserSchema } from '@cockatrice/sockatrice/generated';

import { createStore } from './createStore';
import { Actions as ServerActions } from './server';
import { Actions as RoomsActions } from './rooms';

describe('freezeMessagesMiddleware', () => {
  it('freezes a stored message so in-place mutation throws instead of going stale', () => {
    const store = createStore();
    const user = create(ServerInfo_UserSchema, { name: 'alice' });

    store.dispatch(ServerActions.userJoined({ user }));

    const stored = store.getState().server.users['alice'];
    expect(Object.isFrozen(stored)).toBe(true);
    expect(() => {
      stored.name = 'mallory';
    }).toThrow(TypeError);
    expect(stored.name).toBe('alice');
  });

  it('freezes nested messages and repeated fields inside a stored message', () => {
    const store = createStore();
    const info = create(ServerInfo_RoomSchema, {
      roomId: 7,
      name: 'Test Room',
      userList: [create(ServerInfo_UserSchema, { name: 'bob' })],
    });

    store.dispatch(RoomsActions.roomUpserted({
      roomId: 7,
      info,
      gametypeMap: {},
      order: 0,
      preserveGamesAndUsers: false,
    }));

    const storedInfo = store.getState().rooms.rooms[7].info;
    expect(Object.isFrozen(storedInfo)).toBe(true);
    expect(Object.isFrozen(storedInfo.userList)).toBe(true);
    expect(() => {
      storedInfo.userList.push(create(ServerInfo_UserSchema, { name: 'eve' }));
    }).toThrow(TypeError);
    expect(Object.isFrozen(storedInfo.userList[0])).toBe(true);
    expect(() => {
      storedInfo.userList[0].name = 'mallory';
    }).toThrow(TypeError);
  });

  it('leaves fresh clones of stored messages mutable for the build phase', () => {
    const store = createStore();
    store.dispatch(ServerActions.userJoined({ user: create(ServerInfo_UserSchema, { name: 'alice' }) }));

    const stored = store.getState().server.users['alice'];
    const draft = clone(ServerInfo_UserSchema, stored);

    draft.name = 'alice-edited';
    expect(draft.name).toBe('alice-edited');
    expect(stored.name).toBe('alice');
  });

  it('keeps previously stored messages frozen and identity-stable across unrelated dispatches', () => {
    const store = createStore();
    store.dispatch(ServerActions.userJoined({ user: create(ServerInfo_UserSchema, { name: 'alice' }) }));
    const before = store.getState().server.users['alice'];

    store.dispatch(ServerActions.userJoined({ user: create(ServerInfo_UserSchema, { name: 'bob' }) }));

    const after = store.getState().server.users['alice'];
    expect(after).toBe(before);
    expect(Object.isFrozen(after)).toBe(true);
    expect(Object.isFrozen(store.getState().server.users['bob'])).toBe(true);
  });
});
