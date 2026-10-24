import type { Store } from '@reduxjs/toolkit';
import { ServerInfo_Game, ServerInfo_Room, ServerInfo_User } from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Actions as RoomsActions } from '../store/rooms/rooms.actions';

type Message = WebsocketTypes.WebSocketRoomResponseOverrides['Event_RoomSay'];

export class RoomResponseImpl implements WebsocketTypes.IRoomResponse<WebsocketTypes.WebSocketRoomResponseOverrides> {
  constructor(private store: Store) {}

  clearStore(): void {
    this.store.dispatch(RoomsActions.clearStore());
  }

  joinRoom(roomInfo: ServerInfo_Room, userInitiated?: boolean): void {
    this.store.dispatch(RoomsActions.joinRoom({ roomInfo, userInitiated }));
  }

  leaveRoom(roomId: number): void {
    this.store.dispatch(RoomsActions.leaveRoom({ roomId }));
  }

  updateRooms(rooms: ServerInfo_Room[]): void {
    this.store.dispatch(RoomsActions.updateRooms({ rooms }));
  }

  updateGames(roomId: number, gameList: ServerInfo_Game[]): void {
    this.store.dispatch(RoomsActions.updateGames({ roomId, games: gameList }));
  }

  addMessage(roomId: number, message: Message): void {
    this.store.dispatch(RoomsActions.roomSayReceived({ roomId, message }));
  }

  roomSayFailed(roomId: number, message: string, responseCode: number, failure?: WebsocketTypes.CommandFailure): void {
    this.store.dispatch(RoomsActions.roomSayFailed({ roomId, message, responseCode, failure, timeReceived: Date.now() }));
  }

  userJoined(roomId: number, user: ServerInfo_User): void {
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

  joinedGame(roomId: number, gameId: number, requestId?: string): void {
    this.store.dispatch(RoomsActions.joinedGame({ roomId, gameId, ...(requestId === undefined ? {} : { requestId }) }));
  }

  setJoinGamePending(pending: boolean, requestId?: string): void {
    this.store.dispatch(RoomsActions.setJoinGamePending({ pending, ...(requestId === undefined ? {} : { requestId }) }));
  }

  setJoinGameError(code: number, message: string, failure?: WebsocketTypes.CommandFailure, requestId?: string): void {
    this.store.dispatch(RoomsActions.setJoinGameError({
      code, message,
      ...(failure === undefined ? {} : { failure }),
      ...(requestId === undefined ? {} : { requestId }),
    }));
  }

  joinRoomFailed(
    roomId: number, responseCode: number, failure?: WebsocketTypes.CommandFailure, userInitiated = true, requestId?: string,
  ): void {
    this.store.dispatch(RoomsActions.joinRoomFailed({ roomId, responseCode, failure, userInitiated, requestId }));
  }

  createGameFailed(
    roomId: number, responseCode: number, failure?: WebsocketTypes.CommandFailure, requestId?: string,
  ): void {
    this.store.dispatch(RoomsActions.createGameFailed({ roomId, responseCode, failure, requestId }));
  }
}
