import {
  configureStore,
  type EnhancedStore,
  type Middleware,
  type Reducer,
  type StoreEnhancer,
} from '@reduxjs/toolkit';

import { listenerMiddleware } from './listenerMiddleware';
import { isSerializable } from './isSerializable';
import { rootReducer, type RootState } from './rootReducer';
import { registerServerListeners } from './server/server.listeners';
import { registerGameListeners } from './games/game.listeners';
import { registerRoomsListeners } from './rooms/rooms.listeners';

// Shared with the renderWithProviders-style test harness so test stores
// tolerate the same proto-shaped actions as the production store.
export const storeMiddlewareOptions = {
  immutableCheck: { warnAfter: 128 },
  serializableCheck: { isSerializable, warnAfter: 128 },
} as const;

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
