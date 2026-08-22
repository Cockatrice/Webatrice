import {
  configureStore,
  type EnhancedStore,
  type Middleware,
  type Reducer,
  type StoreEnhancer,
} from '@reduxjs/toolkit';

import { listenerMiddleware } from './listenerMiddleware';
import { rootReducer, type RootState } from './rootReducer';
import { registerServerListeners } from './server/server.listeners';
import { registerGameListeners } from './games/game.listeners';
import { registerRoomsListeners } from './rooms/rooms.listeners';

// Shared with the renderWithProviders-style test harness so test stores
// behave like the production store.
// Both dev-only invariant checks are OFF: every slice (rooms game lists,
// server user lists, in-game board state) holds raw protobuf messages at
// server scale by design, and the checks deep-walk state on every dispatch —
// O(state), charged to whichever dispatch happens to run. On a busy server
// that froze dev for minutes and starved the keepalive until the server
// dropped the connection. Scoped ignoredPaths were tried and remained
// whack-a-slice (host-supplied extension slices can't be pre-listed). Immer
// guarantees reducer immutability; RTK strips these checks from prod builds.
export const storeMiddlewareOptions = {
  immutableCheck: false as const,
  serializableCheck: false as const,
};

let listenersRegistered = false;
function ensureListenersRegistered(): void {
  // See .github/instructions/datatrice.instructions.md#initialization-order.
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;
  registerServerListeners(listenerMiddleware);
  registerGameListeners(listenerMiddleware);
  registerRoomsListeners(listenerMiddleware);
}

export interface CreateStoreOptions<S = RootState> {
  reducer?: Reducer<S>;
  preloadedState?: Partial<S>;
  additionalMiddleware?: Middleware[];
  enhancers?: StoreEnhancer[];
}

export function createStore<S = RootState>(
  options: CreateStoreOptions<S> = {},
): EnhancedStore<S> {
  ensureListenersRegistered();
  const {
    reducer = rootReducer as unknown as Reducer<S>,
    preloadedState,
    additionalMiddleware = [],
  } = options;

  return configureStore({
    reducer,
    preloadedState: preloadedState as Parameters<typeof configureStore>[0]['preloadedState'],
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(storeMiddlewareOptions)
      .prepend(listenerMiddleware.middleware)
      .concat(...additionalMiddleware),
  }) as EnhancedStore<S>;
}
