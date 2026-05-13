import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { combineReducers, type EnhancedStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DndContext } from '@dnd-kit/core';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { WebsocketTypes } from 'sockatrice/types';
import type { WebClient } from 'sockatrice';
import { createStore } from 'datatrice';
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

import { rootReducerMap, type RootState } from '../store';
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

// Required by WebClientProvider's prop typing; the `client` override prop
// short-circuits internal construction so the values are never read.
const TEST_CLIENT_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'webatrice-tests',
  clientver: '0',
  clientfeatures: [],
};
const TEST_CLIENT_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: false,
  keepalive: 0,
};

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  route?: string;
  webClient?: WebClient;
  // Pre-built store override — used by the integration harness, whose
  // setup.ts owns a test store shared with a manually-constructed WebClient.
  // When omitted, the helper builds a fresh store per render.
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
  const store = externalStore ?? createStore<RootState>({
    reducer: combineReducers(rootReducerMap),
    preloadedState,
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <DatatriceProvider store={store}>
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
      </DatatriceProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return {
    ...result,
    webClient,
    store,
  };
}
