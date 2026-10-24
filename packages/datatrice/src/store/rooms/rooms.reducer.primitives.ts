import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Enriched } from '../../types';
import { ServerInfo_Room } from '@cockatrice/sockatrice/generated';

import { RoomsState } from './rooms.interfaces';

function upsertGame(state: RoomsState, roomId: number, gameId: number, game: Enriched.Game): void {
  const room = state.rooms[roomId];
  if (room) {
    room.games[gameId] = game;
  }
}

function removeGame(state: RoomsState, roomId: number, gameId: number): void {
  const room = state.rooms[roomId];
  if (room) {
    delete room.games[gameId];
  }
  if (state.selectedGameIds[roomId] === gameId) {
    state.selectedGameIds[roomId] = undefined;
  }
}

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
    info: ServerInfo_Room;
    gametypeMap: Enriched.GametypeMap;
    order: number;
    preserveGamesAndUsers: boolean;
  }>>,

  roomGameUpserted: ((state, action) => {
    const { roomId, gameId, game } = action.payload;
    upsertGame(state, roomId, gameId, game);
  }) as CaseReducer<RoomsState, PayloadAction<{
    roomId: number;
    gameId: number;
    game: Enriched.Game;
  }>>,

  roomGameRemoved: ((state, action) => {
    const { roomId, gameId } = action.payload;
    removeGame(state, roomId, gameId);
  }) as CaseReducer<RoomsState, PayloadAction<{
    roomId: number;
    gameId: number;
  }>>,

  roomGamesBatchApplied: ((state, action) => {
    const { roomId, changes } = action.payload;
    for (const { gameId, game } of changes) {
      if (game) {
        upsertGame(state, roomId, gameId, game);
      } else {
        removeGame(state, roomId, gameId);
      }
    }
  }) as CaseReducer<RoomsState, PayloadAction<{
    roomId: number;
    changes: { gameId: number; game: Enriched.Game | null }[];
  }>>,
};
