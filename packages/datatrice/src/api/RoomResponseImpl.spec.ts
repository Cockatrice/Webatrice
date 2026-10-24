import { create } from '@bufbuild/protobuf';

import { createStore } from '../store/createStore';
import { ServerInfo_GameSchema, ServerInfo_RoomSchema, ServerInfo_UserSchema } from '@cockatrice/sockatrice/generated';
import { Actions as RoomsActions } from '../store/rooms/rooms.actions';
import { RoomResponseImpl } from './RoomResponseImpl';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

function setup() {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  return { impl: new RoomResponseImpl(store), dispatch };
}

describe('RoomResponseImpl', () => {
  it('clearStore dispatches the clearStore action', () => {
    const { impl, dispatch } = setup();
    impl.clearStore();
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.clearStore());
  });

  it('joinRoom dispatches the joinRoom action with the room info', () => {
    const { impl, dispatch } = setup();
    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    impl.joinRoom(roomInfo);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.joinRoom({ roomInfo }));
  });

  it('joinRoom carries whether the user asked for the room', () => {
    const { impl, dispatch } = setup();
    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    impl.joinRoom(roomInfo, false);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.joinRoom({ roomInfo, userInitiated: false }));
  });

  it('leaveRoom dispatches the leaveRoom action', () => {
    const { impl, dispatch } = setup();
    impl.leaveRoom(7);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.leaveRoom({ roomId: 7 }));
  });

  it('updateRooms dispatches the updateRooms action with the list', () => {
    const { impl, dispatch } = setup();
    const rooms = [create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' })];
    impl.updateRooms(rooms);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.updateRooms({ rooms }));
  });

  it('updateGames dispatches the updateGames action with the list', () => {
    const { impl, dispatch } = setup();
    const games = [create(ServerInfo_GameSchema, { gameId: 9, description: 'g9' })];
    impl.updateGames(2, games);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.updateGames({ roomId: 2, games }));
  });

  it('addMessage dispatches roomSayReceived for the ignore-list listener', () => {
    const { impl, dispatch } = setup();
    const message = { senderName: 'alice', message: 'hi', timeReceived: 123 };
    impl.addMessage(3, message);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.roomSayReceived({ roomId: 3, message }));
  });

  it('roomSayFailed dispatches the roomSayFailed action with a receive time', () => {
    const { impl, dispatch } = setup();
    impl.roomSayFailed(3, 'hello', 18, WebsocketTypes.CommandFailure.Timeout);
    expect(dispatch).toHaveBeenCalledWith({
      type: RoomsActions.roomSayFailed.type,
      payload: {
        roomId: 3, message: 'hello', responseCode: 18, failure: WebsocketTypes.CommandFailure.Timeout, timeReceived: expect.any(Number),
      },
    });
  });

  it('userJoined dispatches the userJoined action', () => {
    const { impl, dispatch } = setup();
    const user = create(ServerInfo_UserSchema, { name: 'alice' });
    impl.userJoined(3, user);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.userJoined({ roomId: 3, user }));
  });

  it('userLeft dispatches the userLeft action', () => {
    const { impl, dispatch } = setup();
    impl.userLeft(3, 'alice');
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.userLeft({ roomId: 3, name: 'alice' }));
  });

  it('removeMessages dispatches the removeMessages action', () => {
    const { impl, dispatch } = setup();
    impl.removeMessages(3, 'alice', 5);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.removeMessages({ roomId: 3, name: 'alice', amount: 5 }));
  });

  it('gameCreated dispatches the gameCreated action', () => {
    const { impl, dispatch } = setup();
    impl.gameCreated(3);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.gameCreated({ roomId: 3 }));
  });

  it('joinedGame dispatches the joinedGame action', () => {
    const { impl, dispatch } = setup();
    impl.joinedGame(3, 42);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.joinedGame({ roomId: 3, gameId: 42 }));
  });

  it('setJoinGamePending dispatches the setJoinGamePending action', () => {
    const { impl, dispatch } = setup();
    impl.setJoinGamePending(true);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.setJoinGamePending({ pending: true }));
  });

  it('setJoinGameError dispatches the setJoinGameError action', () => {
    const { impl, dispatch } = setup();
    impl.setJoinGameError(404, 'not found');
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.setJoinGameError({ code: 404, message: 'not found' }));
  });

  it('joinRoomFailed dispatches joinRoomFailed keyed by roomId', () => {
    const { impl, dispatch } = setup();
    impl.joinRoomFailed(3, 15);
    expect(dispatch).toHaveBeenCalledWith(
      RoomsActions.joinRoomFailed({ roomId: 3, responseCode: 15, failure: undefined, userInitiated: true }),
    );
  });

  it('joinRoomFailed carries an autojoin as not user-initiated', () => {
    const { impl, dispatch } = setup();
    impl.joinRoomFailed(3, 15, undefined, false);
    expect(dispatch).toHaveBeenCalledWith(
      RoomsActions.joinRoomFailed({ roomId: 3, responseCode: 15, failure: undefined, userInitiated: false }),
    );
  });

  it('createGameFailed dispatches createGameFailed with the transport reason', () => {
    const { impl, dispatch } = setup();
    impl.createGameFailed(3, -1, WebsocketTypes.CommandFailure.Timeout);
    expect(dispatch).toHaveBeenCalledWith(
      RoomsActions.createGameFailed({ roomId: 3, responseCode: -1, failure: WebsocketTypes.CommandFailure.Timeout }),
    );
  });
});

describe('join-game request correlation', () => {
  it('carries a successful request identity on its action', () => {
    const { impl, dispatch } = setup();
    impl.joinedGame(3, 42, 'join-a');
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.joinedGame({ roomId: 3, gameId: 42, requestId: 'join-a' }));
  });

  it('carries the identity on pending settlement actions', () => {
    const { impl, dispatch } = setup();
    impl.setJoinGamePending(false, 'join-a');
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.setJoinGamePending({ pending: false, requestId: 'join-a' }));
  });

  it.each([undefined, WebsocketTypes.CommandFailure.Timeout])('carries the identity on a rejection or %s failure', (failure) => {
    const { impl, dispatch } = setup();
    impl.setJoinGameError(12, '', failure, 'join-a');
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.setJoinGameError({
      code: 12, message: '', ...(failure === undefined ? {} : { failure }), requestId: 'join-a',
    }));
  });
});
