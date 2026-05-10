import { createSlice } from '@reduxjs/toolkit';
import { Actions as ServerActions } from '../server/server.actions';
import { GamesState } from './game.interfaces';
import { arrowReducers } from './game.reducer.arrow';
import { cardReducers } from './game.reducer.card';
import { chatReducers } from './game.reducer.chat';
import { counterReducers } from './game.reducer.counter';
import { lifecycleReducers } from './game.reducer.lifecycle';
import { playerReducers } from './game.reducer.player';
import { primitiveReducers } from './game.reducer.primitives';
import { turnReducers } from './game.reducer.turn';

export { MAX_GAME_MESSAGES } from './game.reducer.helpers';

const initialState: GamesState = { games: {} };

export const gamesSlice = createSlice({
  name: 'games',
  initialState,
  reducers: {
    ...lifecycleReducers,
    ...turnReducers,
    ...playerReducers,
    ...cardReducers,
    ...primitiveReducers,
    ...counterReducers,
    ...arrowReducers,
    ...chatReducers,
  },
  extraReducers: (builder) => {
    builder.addCase(ServerActions.disconnected, () => initialState);
  },
});

export const gamesReducer = gamesSlice.reducer;
