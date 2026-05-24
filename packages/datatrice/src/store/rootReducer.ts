import { combineReducers } from '@reduxjs/toolkit';

import { gamesReducer } from './games';
import { roomsReducer } from './rooms';
import { serverReducer } from './server';

// Exposed as a map (not just the combined function) so DatatriceProvider can
// merge host-supplied extensions into the rootReducer at mount time.
export const rootReducerMap = {
  games: gamesReducer,
  rooms: roomsReducer,
  server: serverReducer,
};

export const rootReducer = combineReducers(rootReducerMap);

export type RootState = ReturnType<typeof rootReducer>;
