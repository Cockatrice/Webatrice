import {
  configureStore,
  type EnhancedStore,
  type Middleware,
  type Reducer,
  type StoreEnhancer,
} from '@reduxjs/toolkit';

import { freezeMessagesMiddleware } from './freezeMessagesMiddleware';
import { sanitizeDiagnostics } from './sanitizeDiagnostics';
import { listenerMiddleware } from './listenerMiddleware';
import { rootReducer, type RootState } from './rootReducer';
import { registerServerListeners } from './server/server.listeners';
import { registerGameListeners } from './games/game.listeners';
import { registerRoomsListeners } from './rooms/rooms.listeners';

declare const process: { env: { NODE_ENV?: string } };

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
    devTools: process.env.NODE_ENV === 'production' ? false : {
      actionSanitizer: sanitizeDiagnostics,
      stateSanitizer: sanitizeDiagnostics,
    },
    reducer,
    preloadedState: preloadedState as Parameters<typeof configureStore>[0]['preloadedState'],
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(storeMiddlewareOptions)
      .prepend(listenerMiddleware.middleware)
      .concat(freezeMessagesMiddleware, ...additionalMiddleware),
  }) as EnhancedStore<S>;
}
