import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { Dispatch } from 'redux';

import type { RootState } from '../store/rootReducer';
import type { createStore } from '../store/createStore';

type DatatriceStore = ReturnType<typeof createStore>;
export type AppDispatch = DatatriceStore['dispatch'];

// Default typed hooks bound to Datatrice's base RootState. Suitable for
// consumers that mount <DatatriceProvider> with no extensions.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

// Factory for consumers that mount <DatatriceProvider extensions={...}>.
// Pass the host's augmented RootState as the type parameter; the returned
// hooks understand the full state shape including extensions.
export function createTypedHooks<S>() {
  type AppDispatchOf = ThunkDispatch<S, unknown, UnknownAction> & Dispatch<UnknownAction>;
  return {
    useAppSelector: useSelector.withTypes<S>(),
    useAppDispatch: useDispatch.withTypes<AppDispatchOf>(),
  };
}
