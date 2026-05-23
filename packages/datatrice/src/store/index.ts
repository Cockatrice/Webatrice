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

// Flat type re-exports for slice state shapes. Use these in type positions
// (`const x: GamesState`, `type T = { games: GamesState }`). tsup's bundling
// of `export * as X` namespaces declares type-only members as `typeof X`,
// which prevents `games.GamesState` from being usable as a type at the
// consumer site. The flat re-exports below sidestep that surface.
export type { GamesState } from './games/game.interfaces';
export type { RoomsState, GameFilters, JoinGameError } from './rooms/rooms.interfaces';
export type {
  ServerState,
  ServerStateStatus,
  ServerStateInfo,
  ServerStateLogs,
  TestConnectionStatus,
} from './server/server.interfaces';
