import { configureStore, isPlain } from '@reduxjs/toolkit';
import { isMessage } from '@bufbuild/protobuf';
import { useDispatch, useSelector } from 'react-redux';
import rootReducer from './rootReducer';
import { listenerMiddleware } from './listenerMiddleware';
import './server/server.listeners';
import './game/game.listeners';
import './rooms/rooms.listeners';

export function isSerializable(value: unknown): boolean {
  return isPlain(value) || isMessage(value) || value instanceof Uint8Array || typeof value === 'bigint';
}

export const storeMiddlewareOptions = {
  immutableCheck: { warnAfter: 128 },
  serializableCheck: { isSerializable, warnAfter: 128 },
} as const;

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(storeMiddlewareOptions)
    .concat(listenerMiddleware.middleware),
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
