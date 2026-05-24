import type { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { App, Enriched } from '../../types';
import { ServerInfo_Game, ServerInfo_Room, ServerInfo_User } from '@cockatrice/sockatrice/generated';

import { normalizeRoomInfo, normalizeUserMessage } from '../../common';

import type { GameFilters, RoomsState } from './rooms.interfaces';
import { DEFAULT_GAME_FILTERS } from './gameFilters';

export const MAX_ROOM_MESSAGES = 1000;

export const initialState: RoomsState = {
  rooms: {},
  joinedRoomIds: {},
  joinedGameIds: {},
  messages: {},
  sortGamesBy: {
    field: App.GameSortField.START_TIME,
    order: App.SortDirection.DESC,
  },
  sortUsersBy: {
    field: App.UserSortField.NAME,
    order: App.SortDirection.ASC,
  },
  selectedGameIds: {},
  gameFilters: {},
  joinGamePending: false,
  joinGameError: null,
};

export function removeGameFromRooms(state: RoomsState, gameId: number): void {
  for (const roomId of Object.keys(state.joinedGameIds)) {
    delete state.joinedGameIds[Number(roomId)][gameId];
  }
  for (const [roomId, selected] of Object.entries(state.selectedGameIds)) {
    if (selected === gameId) {
      state.selectedGameIds[Number(roomId)] = undefined;
    }
  }
}

// Typed CaseReducer extraction avoids TS7056. See .github/instructions/datatrice-store.instructions.md#slice-authoring.

export const clearStore: CaseReducer<RoomsState> = () => initialState;

export const updateRooms: CaseReducer<RoomsState, PayloadAction<{ rooms: ServerInfo_Room[] }>> = () => {};

export const joinRoom: CaseReducer<RoomsState, PayloadAction<{ roomInfo: ServerInfo_Room }>> = (state, action) => {
  const { roomInfo: rawRoomInfo } = action.payload;

  const roomEntry = normalizeRoomInfo(rawRoomInfo);
  const roomId = roomEntry.info.roomId;

  state.rooms[roomId] = roomEntry;
  state.joinedRoomIds[roomId] = true;
};

export const leaveRoom: CaseReducer<RoomsState, PayloadAction<{ roomId: number }>> = (state, action) => {
  const { roomId } = action.payload;

  delete state.joinedRoomIds[roomId];
  delete state.joinedGameIds[roomId];
  delete state.messages[roomId];
  delete state.selectedGameIds[roomId];
  delete state.gameFilters[roomId];

  const room = state.rooms[roomId];
  if (room) {
    room.games = {};
    room.users = {};
  }
};

export const addMessage: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; message: Enriched.Message }>
> = (state, action) => {
  const { roomId, message } = action.payload;

  if (!state.messages[roomId]) {
    state.messages[roomId] = [];
  }
  const msgs = state.messages[roomId];
  if (msgs.length >= MAX_ROOM_MESSAGES) {
    state.messages[roomId] = msgs.slice(msgs.length - MAX_ROOM_MESSAGES + 1);
  }
  state.messages[roomId].push(normalizeUserMessage(message));
};

export const updateGames: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; games: ServerInfo_Game[] }>
> = () => {};

export const userJoined: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; user: ServerInfo_User }>
> = (state, action) => {
  const { roomId, user } = action.payload;
  const room = state.rooms[roomId];
  if (!room) {
    return;
  }

  room.users[user.name] = user;
};

export const userLeft: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; name: string }>
> = (state, action) => {
  const { roomId, name } = action.payload;
  const room = state.rooms[roomId];
  if (!room) {
    return;
  }

  delete room.users[name];
};

export const sortGames: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; field: App.GameSortField; order: App.SortDirection }>
> = (state, action) => {
  const { field, order } = action.payload;
  state.sortGamesBy = { field, order };
};

export const removeMessages: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; name: string; amount: number }>
> = (state, action) => {
  const { name, amount, roomId } = action.payload;
  const roomMessages = state.messages[roomId];

  if (!roomMessages) {
    return;
  }

  const prefix = `${name}:`;
  const keep = new Array(roomMessages.length).fill(true);
  let remaining = amount;
  for (let i = roomMessages.length - 1; i >= 0 && remaining > 0; i--) {
    if (roomMessages[i].message.indexOf(prefix) === 0) {
      keep[i] = false;
      remaining--;
    }
  }

  state.messages[roomId] = roomMessages.filter((_, i) => keep[i]);
};

export const gameCreated: CaseReducer<RoomsState, PayloadAction<{ roomId: number }>> = () => {};

export const joinedGame: CaseReducer<
  RoomsState,
  PayloadAction<{ gameId: number; roomId: number }>
> = (state, action) => {
  const { gameId, roomId } = action.payload;

  if (!state.joinedGameIds[roomId]) {
    state.joinedGameIds[roomId] = {};
  }
  state.joinedGameIds[roomId][gameId] = true;
};

export const selectGame: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; gameId: number | undefined }>
> = (state, action) => {
  const { roomId, gameId } = action.payload;
  state.selectedGameIds[roomId] = gameId;
};

export const setGameFilters: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number; filters: GameFilters }>
> = (state, action) => {
  const { roomId, filters } = action.payload;
  state.gameFilters[roomId] = filters;
};

export const clearGameFilters: CaseReducer<
  RoomsState,
  PayloadAction<{ roomId: number }>
> = (state, action) => {
  const { roomId } = action.payload;
  state.gameFilters[roomId] = { ...DEFAULT_GAME_FILTERS };
};

export const setJoinGamePending: CaseReducer<
  RoomsState,
  PayloadAction<{ pending: boolean }>
> = (state, action) => {
  state.joinGamePending = action.payload.pending;
};

export const setJoinGameError: CaseReducer<
  RoomsState,
  PayloadAction<{ code: number; message: string }>
> = (state, action) => {
  state.joinGameError = { code: action.payload.code, message: action.payload.message };
  state.joinGamePending = false;
};

export const clearJoinGameError: CaseReducer<RoomsState> = (state) => {
  state.joinGameError = null;
};

export const inlineReducers = {
  clearStore,
  updateRooms,
  joinRoom,
  leaveRoom,
  addMessage,
  updateGames,
  userJoined,
  userLeft,
  sortGames,
  removeMessages,
  gameCreated,
  joinedGame,
  selectGame,
  setGameFilters,
  clearGameFilters,
  setJoinGamePending,
  setJoinGameError,
  clearJoinGameError,
};
