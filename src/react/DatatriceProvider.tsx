import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import {
  combineReducers,
  type EnhancedStore,
  type Middleware,
  type Reducer,
} from '@reduxjs/toolkit';

import { createStore } from '../store/createStore';
import { rootReducer, rootReducerMap, type RootState } from '../store/rootReducer';

// Reducer map mapped to its derived state type — used to widen the
// `preloadedState` prop when extensions are supplied.
type StateFromReducers<R extends Record<string, Reducer>> = {
  [K in keyof R]: R[K] extends Reducer<infer S> ? S : never;
};

// Discriminated union: either the consumer supplies a pre-built store
// (external-store mode), OR Datatrice constructs one internally from the
// optional extensions/preloadedState/middleware props (internal-store mode).
// The two modes are mutually exclusive — passing `store` alongside any of
// the construction props is a TS error.
export type DatatriceProviderProps<Ext extends Record<string, Reducer> = Record<string, never>> =
  | {
      store: EnhancedStore;
      extensions?: never;
      preloadedState?: never;
      additionalMiddleware?: never;
      children: ReactNode;
    }
  | {
      store?: never;
      extensions?: Ext;
      preloadedState?: Partial<RootState & StateFromReducers<Ext>>;
      additionalMiddleware?: Middleware[];
      children: ReactNode;
    };

export function DatatriceProvider<Ext extends Record<string, Reducer>>(
  props: DatatriceProviderProps<Ext>,
) {
  const [internalStore] = useState(() => {
    if (props.store) {
      return null;
    }
    const reducer = props.extensions
      ? combineReducers({ ...rootReducerMap, ...props.extensions })
      : rootReducer;
    return createStore({
      reducer: reducer as Reducer<RootState>,
      preloadedState: props.preloadedState as Partial<RootState>,
      additionalMiddleware: props.additionalMiddleware,
    });
  });

  const store = props.store ?? internalStore!;
  return <Provider store={store}>{props.children}</Provider>;
}
