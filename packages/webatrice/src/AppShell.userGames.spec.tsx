import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { combineReducers } from '@reduxjs/toolkit';
import { create } from '@bufbuild/protobuf';
import { createStore, rooms, server } from '@cockatrice/datatrice';
import { DatatriceProvider, WebClientContext } from '@cockatrice/datatrice/react';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { Response_GetGamesOfUserSchema, ServerInfo_GameSchema, ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';
import { rootReducerMap, type RootState } from './store';
import { connectedState, createMockWebClient } from './__test-utils__';
import { useUserGames } from './feature-widgets/user-games/useUserGames';
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
vi.mock('./AppShellRoutes', () => ({ default: function OpenUserGames() {
  const userGames = useUserGames();
  return <button onClick={() => userGames?.open('bob')}>show games</button>;
} }));

const theme = createTheme({ components: {
  MuiButtonBase: { defaultProps: { disableRipple: true } },
  MuiDialog: { defaultProps: { transitionDuration: 0 } },
} });

function setup() {
  const store = createStore<RootState>({ reducer: combineReducers(rootReducerMap), preloadedState: connectedState });
  const webClient = createMockWebClient();
  render(<StrictMode><DatatriceProvider store={store}><WebClientContext value={webClient}>
    <ThemeProvider theme={theme}><AppShell /></ThemeProvider>
  </WebClientContext></DatatriceProvider></StrictMode>);
  function loadGame(gameId: number, roomId: number) {
    act(() => {
      store.dispatch(rooms.Actions.joinRoom({ roomInfo: create(ServerInfo_RoomSchema, { roomId }) }));
      store.dispatch(server.Actions.gamesOfUser({ userName: 'bob', response: create(Response_GetGamesOfUserSchema, {
        gameList: [create(ServerInfo_GameSchema, {
          gameId, roomId, description: `Protected ${gameId}`, withPassword: true, playerCount: 1, maxPlayers: 2,
        })],
      }) }));
    });
  }
  return { store, webClient, loadGame };
}

it.each(['disconnect', 'clear-store', 'new-login'] as const)(
  'the real AppShell removes the selector and pending password on %s', (boundary) => {
    const { store, webClient, loadGame } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'show games' }));
    loadGame(7, 2);
    fireEvent.doubleClick(screen.getByText('Protected 7'));
    fireEvent.change(screen.getByLabelText('UserGamesDialog.password.label'), { target: { value: 'old secret' } });
    act(() => {
      if (boundary === 'clear-store') {
        store.dispatch(server.Actions.clearStore());
      } else {
        store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null } }));
        if (boundary === 'new-login') {
          store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
        }
      }
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('old secret')).not.toBeInTheDocument();
    act(() => store.dispatch(server.Actions.updateStatus({
      status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null },
    })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'show games' }));
    expect(screen.queryByLabelText('UserGamesDialog.password.label')).not.toBeInTheDocument();
    loadGame(8, 3);
    fireEvent.doubleClick(screen.getByText('Protected 8'));
    expect(screen.getByLabelText('UserGamesDialog.password.label')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('UserGamesDialog.password.label'), { target: { value: 'new secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'UserGamesDialog.password.submit' }));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledTimes(1);
    expect(vi.mocked(webClient.request.rooms.joinGame).mock.lastCall?.slice(0, 2)).toEqual([
      3, expect.objectContaining({ gameId: 8, password: 'new secret' }),
    ]);
  },
);
