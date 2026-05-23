import type { Store } from '@reduxjs/toolkit';
import { Data } from '../types';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Actions as RoomsActions } from '../store/rooms/rooms.actions';

type Message = WebsocketTypes.WebSocketRoomResponseOverrides['Event_RoomSay'];

export class RoomResponseImpl implements WebsocketTypes.IRoomResponse<WebsocketTypes.WebSocketRoomResponseOverrides> {
  constructor(private store: Store) {}

  clearStore(): void {
    this.store.dispatch(RoomsActions.clearStore());
  }

  joinRoom(roomInfo: Data.ServerInfo_Room): void {
    this.store.dispatch(RoomsActions.joinRoom({ roomInfo }));
  }

  leaveRoom(roomId: number): void {
    this.store.dispatch(RoomsActions.leaveRoom({ roomId }));
  }

  updateRooms(rooms: Data.ServerInfo_Room[]): void {
    this.store.dispatch(RoomsActions.updateRooms({ rooms }));
  }

  updateGames(roomId: number, gameList: Data.ServerInfo_Game[]): void {
    this.store.dispatch(RoomsActions.updateGames({ roomId, games: gameList }));
  }

  addMessage(roomId: number, message: Message): void {
    this.store.dispatch(RoomsActions.addMessage({ roomId, message }));
  }

  userJoined(roomId: number, user: Data.ServerInfo_User): void {
    this.store.dispatch(RoomsActions.userJoined({ roomId, user }));
  }

  userLeft(roomId: number, name: string): void {
    this.store.dispatch(RoomsActions.userLeft({ roomId, name }));
  }

  removeMessages(roomId: number, name: string, amount: number): void {
    this.store.dispatch(RoomsActions.removeMessages({ roomId, name, amount }));
  }

  gameCreated(roomId: number): void {
    this.store.dispatch(RoomsActions.gameCreated({ roomId }));
  }

  joinedGame(roomId: number, gameId: number): void {
    this.store.dispatch(RoomsActions.joinedGame({ roomId, gameId }));
  }

  setJoinGamePending(pending: boolean): void {
    this.store.dispatch(RoomsActions.setJoinGamePending({ pending }));
  }

  setJoinGameError(code: number, message: string): void {
    this.store.dispatch(RoomsActions.setJoinGameError({ code, message }));
  }
}
