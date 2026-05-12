import { combineReducers } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import {
  createStore as createDatatriceStore,
  SortUtil,
  attachResponseHandlers,
  server as datatriceServer,
  rooms as datatriceRooms,
  games as datatriceGames,
} from 'datatrice';

import { actionReducer } from './actions';
import { shortcutsReducer } from './shortcuts';

// Webatrice's root reducer = Datatrice's three server-data slices + Webatrice's
// two local slices (`action` for useReduxEffect bookkeeping, `shortcuts` for UI
// keybindings). Exported so renderWithProviders can build identically-shaped
// test stores.
export const rootReducer = combineReducers({
  server: datatriceServer.serverReducer,
  rooms: datatriceRooms.roomsReducer,
  games: datatriceGames.gamesReducer,
  action: actionReducer,
  shortcuts: shortcutsReducer,
});

export const store = createDatatriceStore({ reducer: rootReducer });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

// Re-export Datatrice's slice APIs under the names Webatrice's call sites have
// used historically (preserves the broad `@app/store` import surface so the
// migration is a single-file change here rather than a sweep across 60+
// consumer files).
//
// Slice reducers (gamesReducer / roomsReducer / serverReducer) are deliberately
// NOT re-exported here. Importing them from `@app/store` would eagerly
// evaluate this file → `createDatatriceStore(...)` → singleton instantiation,
// which races with the test-local stores in spec files that build their own
// reducer wiring. Specs that need raw reducers reach into
// src/store/{slice}/{slice}.reducer.ts (thin shims that re-export from
// `datatrice` without triggering the singleton).
export const GameActions = datatriceGames.Actions;
export const GameSelectors = datatriceGames.Selectors;
export const GameTypes = datatriceGames.Types;
export type AttachedChild = datatriceGames.AttachedChild;
export type GamesState = datatriceGames.GamesState;

export const ServerActions = datatriceServer.Actions;
export const ServerSelectors = datatriceServer.Selectors;
export const ServerTypes = datatriceServer.Types;
export type ServerState = datatriceServer.ServerState;
export type ServerStateLogs = datatriceServer.ServerStateLogs;
export type TestConnectionStatus = datatriceServer.TestConnectionStatus;

export const RoomsActions = datatriceRooms.Actions;
export const RoomsSelectors = datatriceRooms.Selectors;
export const RoomsTypes = datatriceRooms.Types;
export type RoomsState = datatriceRooms.RoomsState;
export const DEFAULT_GAME_FILTERS = datatriceRooms.DEFAULT_GAME_FILTERS;
export const DEFAULT_MAX_PLAYERS_MIN = datatriceRooms.DEFAULT_MAX_PLAYERS_MIN;
export const DEFAULT_MAX_PLAYERS_MAX = datatriceRooms.DEFAULT_MAX_PLAYERS_MAX;
export const DEFAULT_MAX_GAME_AGE_SECONDS = datatriceRooms.DEFAULT_MAX_GAME_AGE_SECONDS;
export const isGameFiltersAtDefaults = datatriceRooms.isGameFiltersAtDefaults;
export const gameMatchesFilters = datatriceRooms.gameMatchesFilters;
export type GameFilters = datatriceRooms.GameFilters;
export type GameFilterContext = datatriceRooms.GameFilterContext;

// Shortcuts slice stays in Webatrice.
export {
  Actions as ShortcutsActions,
  Dispatch as ShortcutsDispatch,
  Selectors as ShortcutsSelectors,
} from './shortcuts';
export type { ShortcutsState } from './shortcuts';

// Generic helper exposed by Datatrice's common module.
export { SortUtil };

// Datatrice ↔ Sockatrice bridge for useWebClient.
export { attachResponseHandlers };
