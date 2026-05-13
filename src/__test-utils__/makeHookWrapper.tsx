import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore, Reducer } from '@reduxjs/toolkit';

import type { WebClient } from 'sockatrice';
import { WebClientContext } from 'datatrice/react';

import { createMockWebClient } from './mockWebClient';

// Minimal Provider wrapper for hook-only `renderHook` tests — skips
// `<DatatriceProvider>` so the test can preload a narrow reducer slice
// instead of the full augmented store. Deep-import the reducer you need
// (see useCurrentGame.spec.tsx for the canonical pattern).

export function makeReduxHookWrapper<S>(
  reducer: Reducer<S>,
  preloadedState: S,
) {
  const store = configureStore({
    reducer,
    preloadedState: preloadedState as Parameters<typeof configureStore>[0]['preloadedState'],
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }
  return { Wrapper, store };
}

export interface MakeReduxWebClientHookWrapperOptions<S> {
  reducer: Reducer<S>;
  preloadedState: S;
  webClient?: WebClient;
}

export function makeReduxWebClientHookWrapper<S>({
  reducer,
  preloadedState,
  webClient,
}: MakeReduxWebClientHookWrapperOptions<S>) {
  const store = configureStore({
    reducer,
    preloadedState: preloadedState as Parameters<typeof configureStore>[0]['preloadedState'],
  });
  const client = webClient ?? createMockWebClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={client}>{children}</WebClientContext>
      </Provider>
    );
  }
  return { Wrapper, store, webClient: client };
}
