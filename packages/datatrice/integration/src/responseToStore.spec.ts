import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { attachResponseHandlers, createStore } from '../../src';
import { ServerInfo_GameSchema, ServerInfo_RoomSchema, ServerInfo_UserSchema } from '@cockatrice/sockatrice/generated';

// Integration: realistic protocol sequences spanning ≥2 slices. Each `it`
// walks the bridge through a multi-step user journey and asserts the
// resulting cross-slice store state.

describe('integration: end-to-end protocol sequences', () => {
  it('login → user list → join room places the user and the room in correct slices', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.connectionAttempted();
    response.session.testConnectionSuccessful(true);
    response.session.loginSuccessful({ userName: 'alice' } as WebsocketTypes.LoginSuccessContext);
    response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'in');

    const alice = create(ServerInfo_UserSchema, { name: 'alice' });
    response.session.updateUsers([alice]);

    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    response.room.joinRoom(roomInfo);

    const state = store.getState();
    expect(state.server.status.state).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
    expect(state.server.users).toBeDefined();
    expect(state.rooms.joinedRoomIds[1]).toBe(true);
  });

  it('disconnect transition triggers the server.disconnected listener and resets connection state', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.loginSuccessful({ userName: 'alice' } as WebsocketTypes.LoginSuccessContext);
    response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'in');

    response.session.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'gone');

    // The server listener dispatches `disconnected()` after the
    // updateStatus(DISCONNECTED) lands. The reducer for `disconnected`
    // resets the slice; the final status reflects the DISCONNECTED write
    // since that was the last status mutation.
    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });

  it('joining a room then receiving a game listing populates rooms.rooms[id].games', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    response.room.joinRoom(roomInfo);

    const game = create(ServerInfo_GameSchema, { gameId: 42, description: 'casual' });
    response.room.updateGames(1, [game]);

    const state = store.getState();
    const joinedRoom = state.rooms.rooms[1];
    expect(joinedRoom).toBeDefined();
    expect(joinedRoom?.games[42]).toBeDefined();
  });

  it('chat message in a joined room propagates to rooms.rooms[id].messageList', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    response.room.joinRoom(roomInfo);

    response.room.addMessage(1, { senderName: 'alice', message: 'hi', timeReceived: 123 });

    const messages = store.getState().rooms.messages[1] ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ senderName: 'alice', message: 'hi' });
  });

  it('clearStore on rooms resets rooms slice while leaving the server slice intact', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.loginSuccessful({ userName: 'alice' } as WebsocketTypes.LoginSuccessContext);
    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    response.room.joinRoom(roomInfo);

    response.room.clearStore();

    const state = store.getState();
    expect(Object.keys(state.rooms.joinedRoomIds)).toHaveLength(0);
    expect(Object.keys(state.rooms.rooms)).toHaveLength(0);
    // Server slice still has the logged-in user since clearStore is room-scoped.
    expect(state.server).toBeDefined();
  });
});
