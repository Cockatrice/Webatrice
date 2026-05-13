import type { Reducer } from '@reduxjs/toolkit';
import { rootReducerMap as datatriceRootReducerMap } from 'datatrice';
import { createTypedHooks } from 'datatrice/react';

import { actionReducer } from './actions';
import { shortcutsReducer } from './shortcuts';

// Webatrice's local UI-keybinding slice, exposed via a namespace re-export
// that mirrors Datatrice's slice surface (`games.Actions`, `server.Selectors`
// etc.). Consumers reach Shortcuts via `shortcuts.Actions` / `shortcuts.Selectors`.
export * as shortcuts from './shortcuts';

// Extensions slot consumed by <DatatriceProvider extensions={extensions}>.
// Datatrice owns store creation; this is the seam where Webatrice's two
// local slices (`action` for useReduxEffect bookkeeping, `shortcuts` for UI
// keybindings) join Datatrice's three server-data slices.
export const extensions = {
  action: actionReducer,
  shortcuts: shortcutsReducer,
};

// renderWithProviders builds preloaded test stores against this map. Kept
// for the test harness; production code consumes the Provider-owned store
// via the typed hooks below.
export const rootReducerMap = {
  ...datatriceRootReducerMap,
  ...extensions,
};

type StateFromReducerMap<R extends Record<string, Reducer>> = {
  [K in keyof R]: R[K] extends Reducer<infer S> ? S : never;
};

// Webatrice's augmented RootState — Datatrice's base + the two extensions.
// Used purely for typing; there's no module-singleton store post-migration.
export type RootState = StateFromReducerMap<typeof rootReducerMap>;

// Typed hooks bound to Webatrice's augmented RootState — selectors can
// reach into both Datatrice slices (server/rooms/games) and Webatrice's
// local slices (action/shortcuts) without casts.
const hooks = createTypedHooks<RootState>();
export const useAppSelector = hooks.useAppSelector;
export const useAppDispatch = hooks.useAppDispatch;
export type AppDispatch = ReturnType<typeof useAppDispatch>;
