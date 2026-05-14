import type { Reducer } from '@reduxjs/toolkit';
import { rootReducerMap as datatriceRootReducerMap } from '@cockatrice/datatrice';
import { createTypedHooks } from '@cockatrice/datatrice/react';

import { actionReducer } from './actions';
import { shortcutsReducer } from './shortcuts';

// Mirrors Datatrice's namespace shape (`shortcuts.Actions` / `shortcuts.Selectors`).
export * as shortcuts from './shortcuts';

// Webatrice's two host-level slices, passed to `<DatatriceProvider extensions={extensions}>`.
// `action` backs useReduxEffect bookkeeping; `shortcuts` backs UI keybindings.
export const extensions = {
  action: actionReducer,
  shortcuts: shortcutsReducer,
};

export const rootReducerMap = {
  ...datatriceRootReducerMap,
  ...extensions,
};

type StateFromReducerMap<R extends Record<string, Reducer>> = {
  [K in keyof R]: R[K] extends Reducer<infer S> ? S : never;
};

export type RootState = StateFromReducerMap<typeof rootReducerMap>;

const hooks = createTypedHooks<RootState>();
export const useAppSelector = hooks.useAppSelector;
export const useAppDispatch = hooks.useAppDispatch;
export type AppDispatch = ReturnType<typeof useAppDispatch>;
