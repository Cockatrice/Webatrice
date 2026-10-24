import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { combineReducers } from '@reduxjs/toolkit';
import { createStore, server } from '@cockatrice/datatrice';
import { DatatriceProvider, WebClientContext } from '@cockatrice/datatrice/react';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { rootReducerMap, type RootState } from './store';
import { connectedState, disconnectedState, createMockWebClient } from './__test-utils__';
import { useReportUser } from './dialogs/ReportUserDialog/ReportUserContext';
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
vi.mock('./AppShellRoutes', () => ({ default: function OpenReport() {
  const { openReportUser } = useReportUser();
  return <>
    <button onClick={() => openReportUser({ userName: 'old target', gameId: 42, chatContext: 'old evidence' })}>old report</button>
    <button onClick={() => openReportUser({ userName: 'new target' })}>new report</button>
  </>;
} }));

const theme = createTheme({ components: {
  MuiButtonBase: { defaultProps: { disableRipple: true } },
  MuiDialog: { defaultProps: { transitionDuration: 0 } },
} });

it.each(['disconnect', 'clear-store', 'new-login'] as const)(
  'the real AppShell discards the report target, draft and evidence on %s', async (boundary) => {
    const store = createStore<RootState>({
      reducer: combineReducers(rootReducerMap),
      preloadedState: boundary === 'new-login' ? disconnectedState : connectedState,
    });
    const webClient = createMockWebClient();
    render(<StrictMode><DatatriceProvider store={store}><WebClientContext value={webClient}>
      <ThemeProvider theme={theme}><AppShell /></ThemeProvider>
    </WebClientContext></DatatriceProvider></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'old report' }));
    fireEvent.change(screen.getByLabelText('ReportUserDialog.descriptionGroup'), { target: { value: 'old draft' } });
    expect(screen.getByTestId('report-reported-user')).toHaveTextContent('old target');
    expect(screen.getByLabelText('ReportUserDialog.chatGroup')).toHaveValue('old evidence');
    expect(screen.getByLabelText('ReportUserDialog.gameId')).toHaveTextContent('42');
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
    expect(screen.queryByTestId('report-reported-user')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('old draft')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('old evidence')).not.toBeInTheDocument();
    act(() => store.dispatch(server.Actions.updateStatus({
      status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null },
    })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'new report' }));
    expect(screen.getByTestId('report-reported-user')).toHaveTextContent('new target');
    expect(screen.getByLabelText('ReportUserDialog.descriptionGroup')).toHaveValue('');
    expect(screen.getByLabelText('ReportUserDialog.chatGroup')).toHaveValue('');
    expect(screen.getByLabelText('ReportUserDialog.gameId')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('ReportUserDialog.descriptionGroup'), { target: { value: 'new draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'ReportUserDialog.submit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ReportUserDialog.confirmYes' }));
    expect(webClient.request.session.report).toHaveBeenCalledTimes(1);
    expect(vi.mocked(webClient.request.session.report).mock.lastCall?.[0]).toEqual({
      reportedUser: 'new target', category: 'cheating', description: 'new draft', gameId: undefined, chatLog: undefined,
    });
  },
);
