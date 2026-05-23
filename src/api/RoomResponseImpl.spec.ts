import { create } from '@bufbuild/protobuf';

import { createStore } from '../store/createStore';
import { Data } from '../types';
import { Actions as RoomsActions } from '../store/rooms/rooms.actions';
import { RoomResponseImpl } from './RoomResponseImpl';

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
    const roomInfo = create(Data.ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    impl.joinRoom(roomInfo);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.joinRoom({ roomInfo }));
  });

  it('leaveRoom dispatches the leaveRoom action', () => {
    const { impl, dispatch } = setup();
    impl.leaveRoom(7);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.leaveRoom({ roomId: 7 }));
  });

  it('updateRooms dispatches the updateRooms action with the list', () => {
    const { impl, dispatch } = setup();
    const rooms = [create(Data.ServerInfo_RoomSchema, { roomId: 1, name: 'Main' })];
    impl.updateRooms(rooms);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.updateRooms({ rooms }));
  });

  it('updateGames dispatches the updateGames action with the list', () => {
    const { impl, dispatch } = setup();
    const games = [create(Data.ServerInfo_GameSchema, { gameId: 9, description: 'g9' })];
    impl.updateGames(2, games);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.updateGames({ roomId: 2, games }));
  });

  it('addMessage dispatches the addMessage action', () => {
    const { impl, dispatch } = setup();
    const message = { senderName: 'alice', message: 'hi', timeReceived: 123 };
    impl.addMessage(3, message);
    expect(dispatch).toHaveBeenCalledWith(RoomsActions.addMessage({ roomId: 3, message }));
  });

  it('userJoined dispatches the userJoined action', () => {
    const { impl, dispatch } = setup();
    const user = create(Data.ServerInfo_UserSchema, { name: 'alice' });
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
});
