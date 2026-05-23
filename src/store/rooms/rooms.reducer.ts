import { createSlice } from '@reduxjs/toolkit';

import { Actions as GameActions } from '../games/game.actions';
import { Actions as ServerActions } from '../server/server.actions';

import type { RoomsState } from './rooms.interfaces';
import { primitiveReducers } from './rooms.reducer.primitives';
import {
  MAX_ROOM_MESSAGES,
  initialState,
  inlineReducers,
  removeGameFromRooms,
} from './rooms.reducer.inline';

export { MAX_ROOM_MESSAGES };

export const roomsSlice = createSlice({
  name: 'rooms',
  initialState,
  reducers: {
    ...inlineReducers,
    ...primitiveReducers,
  },
  extraReducers: (builder) => {
    const onGameRemoved = (
      state: RoomsState,
      action: { payload: { gameId: number } },
    ) => {
      removeGameFromRooms(state, action.payload.gameId);
    };
    builder
      .addCase(GameActions.gameLeft, onGameRemoved)
      .addCase(GameActions.gameClosed, onGameRemoved)
      .addCase(GameActions.kicked, onGameRemoved)
      .addCase(ServerActions.disconnected, () => initialState);
  },
});

export const roomsReducer = roomsSlice.reducer;
