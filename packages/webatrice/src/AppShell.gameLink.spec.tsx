import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { combineReducers } from '@reduxjs/toolkit';
import { createStore, server } from '@cockatrice/datatrice';
import { DatatriceProvider, WebClientContext } from '@cockatrice/datatrice/react';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { rootReducerMap, type RootState } from './store';
import { connectedState, disconnectedState, createMockWebClient } from './__test-utils__';
import { requestGameLinkJoin } from './components/GameLink/gameLinkRequests';
import AppShell from './AppShell';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));
vi.mock('./features/shell', () => ({
  AppAlerts: () => null, FeatureDetection: () => null, CommandFailureNotices: () => null, ServerNotices: () => null,
  MissingFeaturesNotice: () => null,
}));
vi.mock('./features/player', () => ({ PrivateMessageNotifier: () => null }));
vi.mock('./feature-widgets/shortcuts/useShortcutsHydration', () => ({ useShortcutsHydration: () => {} }));
vi.mock('./feature-widgets/shortcuts/useShortcutsPersistence', () => ({ useShortcutsPersistence: () => {} }));
vi.mock('./AppShellRoutes', () => ({ default: () => null }));

const theme = createTheme({ components: {
  MuiButtonBase: { defaultProps: { disableRipple: true } },
  MuiDialog: { defaultProps: { transitionDuration: 0 } },
} });

const link = 'cockatrice://joingame?hostname=localhost&port=4747&roomid=1&gameid=7';

it.each(['disconnect', 'clear-store', 'new-login'] as const)(
  'the real AppShell discards an open game-link flow on %s', (boundary) => {
    const store = createStore<RootState>({
      reducer: combineReducers(rootReducerMap),
      preloadedState: boundary === 'new-login' ? disconnectedState : connectedState,
    });
    const webClient = createMockWebClient();
    render(<StrictMode><DatatriceProvider store={store}><WebClientContext value={webClient}>
      <ThemeProvider theme={theme}><AppShell /></ThemeProvider>
    </WebClientContext></DatatriceProvider></StrictMode>);
    act(() => requestGameLinkJoin(link));
    expect(screen.getByRole('dialog')).toHaveTextContent('GameLink.confirm.title');
    act(() => {
      if (boundary === 'clear-store') {
        store.dispatch(server.Actions.clearStore());
      } else {
        store.dispatch(server.Actions.updateStatus({ status: {
          state: boundary === 'new-login' ? WebsocketTypes.StatusEnum.LOGGED_IN : WebsocketTypes.StatusEnum.DISCONNECTED,
          description: null,
        } }));
      }
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      requestGameLinkJoin(link);
      store.dispatch(server.Actions.clearStore());
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => requestGameLinkJoin(link));
    expect(screen.getByRole('dialog')).toHaveTextContent('GameLink.confirm.title');
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
  },
);
