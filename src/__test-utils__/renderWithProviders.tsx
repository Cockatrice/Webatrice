import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider, useStore } from 'react-redux';
import type { EnhancedStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DndContext } from '@dnd-kit/core';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { WebsocketTypes } from 'sockatrice/types';
import type { WebClient } from 'sockatrice';
import { DatatriceProvider, WebClientProvider } from 'datatrice/react';

const testTheme = createTheme({
  transitions: {
    duration: {
      shortest: 0, shorter: 0, short: 0,
      standard: 0, complex: 0,
      enteringScreen: 0, leavingScreen: 0,
    },
    create: () => 'none',
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiDialog: { defaultProps: { transitionDuration: 0 } },
    MuiMenu: { defaultProps: { transitionDuration: 0 } },
    MuiPopover: { defaultProps: { transitionDuration: 0 } },
    MuiTooltip: { defaultProps: { enterDelay: 0, leaveDelay: 0 } },
  },
});

import { extensions, type RootState } from '../store';
import { ToastProvider } from '../components/Toast/ToastContext';
import { createMockWebClient } from './mockWebClient';

let defaultWebClient: WebClient | undefined;
function getDefaultWebClient(): WebClient {
  if (!defaultWebClient) {
    defaultWebClient = createMockWebClient();
  }
  return defaultWebClient;
}

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en-US',
  resources: { 'en-US': { translation: {} } },
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

// Test-only config; WebClient never actually opens a socket in tests because
// the `client` override prop short-circuits internal construction. These
// values exist purely to satisfy WebClientProvider's required prop typing.
const TEST_CLIENT_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'webatrice-tests',
  clientver: '0',
  clientfeatures: [],
};
const TEST_CLIENT_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: false,
  keepalive: 0,
};

// Captures DatatriceProvider's internal store via `useStore()` so callers
// that need `result.store.dispatch(...)` keep working. DatatriceProvider
// builds its store synchronously on first mount; this capture lands during
// the same render tick, so the ref is populated by the time `render()`
// returns. Don't use it before render — it'll be null.
function StoreCapture({ storeRef }: { storeRef: { current: EnhancedStore<RootState> | null } }) {
  storeRef.current = useStore() as EnhancedStore<RootState>;
  return null;
}

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  route?: string;
  webClient?: WebClient;
  // Pre-built store override — used by the integration harness, whose
  // setup.ts owns a singleton store shared with a manually-constructed
  // WebClient. When passed, skip <DatatriceProvider> (which would create
  // its own internal store) and wrap with react-redux's <Provider> directly
  // so the React tree reads from the same store the WebClient writes to.
  store?: EnhancedStore<RootState>;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    route = '/',
    webClient = getDefaultWebClient(),
    store: externalStore,
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  const storeRef: { current: EnhancedStore<RootState> | null } = { current: null };

  function Wrapper({ children }: { children: React.ReactNode }) {
    const innerProviders = (
      <WebClientProvider config={TEST_CLIENT_CONFIG} options={TEST_CLIENT_OPTIONS} client={webClient}>
        <I18nextProvider i18n={testI18n}>
          <ThemeProvider theme={testTheme}>
            <ToastProvider>
              <MemoryRouter initialEntries={[route]}>
                <DndContext
                  accessibility={{
                    screenReaderInstructions: { draggable: '' },
                  }}
                >
                  {children}
                </DndContext>
              </MemoryRouter>
            </ToastProvider>
          </ThemeProvider>
        </I18nextProvider>
      </WebClientProvider>
    );

    if (externalStore) {
      storeRef.current = externalStore;
      return <Provider store={externalStore}>{innerProviders}</Provider>;
    }

    return (
      <DatatriceProvider extensions={extensions} preloadedState={preloadedState}>
        <StoreCapture storeRef={storeRef} />
        {innerProviders}
      </DatatriceProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return {
    ...result,
    webClient,
    store: storeRef.current!,
  };
}
