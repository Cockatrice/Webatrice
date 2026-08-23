import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Enriched } from '../../types';
import { ServerInfo_Room } from '@cockatrice/sockatrice/generated';

import { RoomsState } from './rooms.interfaces';

// Single source of truth for the two game mutations, shared by the per-game
// case reducers and the batch reducer so their semantics can't drift.
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

  // One Event_ListGames frame = one dispatch. Changes apply in event order
  // (game: null = removal) so a close-then-recreate of the same gameId within
  // a frame resolves identically to the former per-game dispatch sequence.
  // Batching exists because a busy server's join snapshot carries thousands of
  // games; per-game dispatches invalidated selectors N times per frame (and
  // made the dev invariant middleware walks O(games²)).
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
