import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Data, Enriched } from '@app/types';

import { RoomsState } from './rooms.interfaces';

export const primitiveReducers = {
  roomUpserted: ((state, action) => {
    const { roomId, info, gametypeMap, order, preserveGamesAndUsers } = action.payload;
    const existing = state.rooms[roomId];
    if (preserveGamesAndUsers && existing) {
      existing.info = info;
      existing.gametypeMap = gametypeMap;
      existing.order = order;
      return;
    }
    state.rooms[roomId] = {
      info,
      gametypeMap,
      order,
      games: {},
      users: {},
    };
  }) as CaseReducer<RoomsState, PayloadAction<{
    roomId: number;
    info: Data.ServerInfo_Room;
    gametypeMap: Enriched.GametypeMap;
    order: number;
    preserveGamesAndUsers: boolean;
  }>>,

  roomGameUpserted: ((state, action) => {
    const { roomId, gameId, game } = action.payload;
    const room = state.rooms[roomId];
    if (!room) {
      return;
    }
    room.games[gameId] = game;
  }) as CaseReducer<RoomsState, PayloadAction<{
    roomId: number;
    gameId: number;
    game: Enriched.Game;
  }>>,

  roomGameRemoved: ((state, action) => {
    const { roomId, gameId } = action.payload;
    const room = state.rooms[roomId];
    if (room) {
      delete room.games[gameId];
    }
    if (state.selectedGameIds[roomId] === gameId) {
      state.selectedGameIds[roomId] = undefined;
    }
  }) as CaseReducer<RoomsState, PayloadAction<{
    roomId: number;
    gameId: number;
  }>>,
};
