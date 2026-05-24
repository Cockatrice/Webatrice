export { createStore, storeMiddlewareOptions, type CreateStoreOptions } from './createStore';
export { rootReducer, rootReducerMap, type RootState } from './rootReducer';
export { isSerializable } from './isSerializable';
export { listenerMiddleware } from './listenerMiddleware';

// Per-slice namespace re-exports. Consumers use these as:
//   import { server } from 'datatrice';
//   server.Actions.userJoined({ user })
//   server.Selectors.selectBuddyList(state)
//   server.registerServerListeners(mw)
export * as server from './server';
export * as rooms from './rooms';
export * as games from './games';

// Flat type re-exports — sidestep tsup's namespace-of-types limitation.
// See .github/instructions/datatrice-store.instructions.md#slice-authoring.
export type { GamesState } from './games/game.interfaces';
export type { RoomsState, GameFilters, JoinGameError } from './rooms/rooms.interfaces';
export type {
  ServerState,
  ServerStateStatus,
  ServerStateInfo,
  ServerStateLogs,
  TestConnectionStatus,
} from './server/server.interfaces';
