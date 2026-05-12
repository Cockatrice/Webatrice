import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import type { EnhancedStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DndContext } from '@dnd-kit/core';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { createStore } from 'datatrice';

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

import { WebClientContext } from '../hooks/useWebClient';
import type { WebClient } from '@app/websocket';
import { rootReducer, type RootState } from '../store';
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

function createTestStore(preloadedState?: Partial<RootState>) {
  // Datatrice's createStore registers the three server-data slice listeners
  // exactly once across the process, so the same store/middleware wiring
  // that ships in production also drives the test harness.
  return createStore<RootState>({
    reducer: rootReducer,
    preloadedState,
  });
}

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: EnhancedStore;
  route?: string;
  webClient?: WebClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = createTestStore(preloadedState),
    route = '/',
    webClient = getDefaultWebClient(),
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <I18nextProvider i18n={testI18n}>
          <ThemeProvider theme={testTheme}>
            <ToastProvider>
              <MemoryRouter initialEntries={[route]}>
                <WebClientContext value={webClient}>
                  <DndContext
                    accessibility={{
                      screenReaderInstructions: { draggable: '' },
                    }}
                  >
                    {children}
                  </DndContext>
                </WebClientContext>
              </MemoryRouter>
            </ToastProvider>
          </ThemeProvider>
        </I18nextProvider>
      </Provider>
    );
  }

  return {
    store,
    webClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
