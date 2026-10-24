import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { combineReducers } from '@reduxjs/toolkit';
import { create } from '@bufbuild/protobuf';
import { createStore, rooms, server } from '@cockatrice/datatrice';
import { DatatriceProvider, WebClientContext } from '@cockatrice/datatrice/react';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import {
  Event_NotifyUserSchema, Event_NotifyUser_NotificationType, Event_ServerShutdownSchema, Response_ResponseCode,
} from '@cockatrice/sockatrice/generated';

import { rootReducerMap, type RootState } from './store';
import { connectedState, createMockWebClient } from './__test-utils__';
import AppShell from './AppShell';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const t = (key: string, values?: Record<string, unknown>) => values ? `${key} ${JSON.stringify(values)}` : key;
  return { ...actual, useTranslation: () => ({ t, i18n: { language: 'en-US' } }) };
});
vi.mock('./features/shell/FeatureDetection', () => ({ default: () => null }));
vi.mock('./features/player', () => ({ PrivateMessageNotifier: () => null }));
vi.mock('./feature-widgets/shortcuts/useShortcutsHydration', () => ({ useShortcutsHydration: () => {} }));
vi.mock('./feature-widgets/shortcuts/useShortcutsPersistence', () => ({ useShortcutsPersistence: () => {} }));
vi.mock('./AppShellRoutes', () => ({ default: function SessionDraft() {
  const [draft, setDraft] = useState('');
  return <input aria-label="session draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
} }));

const theme = createTheme({ components: {
  MuiButtonBase: { defaultProps: { disableRipple: true } },
  MuiDialog: { defaultProps: { transitionDuration: 0 } },
} });

function setup() {
  const store = createStore<RootState>({ reducer: combineReducers(rootReducerMap), preloadedState: connectedState });
  render(
    <StrictMode>
      <DatatriceProvider store={store}>
        <WebClientContext value={createMockWebClient()}><ThemeProvider theme={theme}><AppShell /></ThemeProvider></WebClientContext>
      </DatatriceProvider>
    </StrictMode>,
  );
  return store;
}

const disconnect = () => server.Actions.updateStatus({
  status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null },
});
const warning = () => server.Actions.notifyUser({ notification: create(Event_NotifyUserSchema, {
  type: Event_NotifyUser_NotificationType.WARNING, warningReason: 'Banned: repeated abuse',
}) });

it.each([false, true])('keeps a ban notice across disconnect and store reset (same batch: %s)', (sameBatch) => {
  const store = setup();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'old session' } });
  act(() => {
    store.dispatch(warning());
    if (sameBatch) {
      store.dispatch(disconnect());
    }
  });
  expect(screen.getByText(/Banned: repeated abuse/)).toBeVisible();
  if (!sameBatch) {
    act(() => store.dispatch(disconnect()));
  }
  expect(screen.getByText(/Banned: repeated abuse/)).toBeVisible();
  expect(screen.getByLabelText('session draft')).toHaveValue('');
  act(() => store.dispatch(server.Actions.clearStore()));
  expect(screen.getByText(/Banned: repeated abuse/)).toBeVisible();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByText(/Banned: repeated abuse/)).not.toBeInTheDocument();
  act(() => store.dispatch(server.Actions.updateStatus({
    status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null },
  })));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps command failures before and during disconnection until each is dismissed', () => {
  const store = setup();
  act(() => {
    store.dispatch(rooms.Actions.createGameFailed({ roomId: 1, responseCode: Response_ResponseCode.RespContextError }));
    store.dispatch(disconnect());
    store.dispatch(server.Actions.deckUploadFailed({
      path: '', responseCode: Response_ResponseCode.RespNotConnected, failure: WebsocketTypes.CommandFailure.Disconnected,
    }));
  });
  expect(screen.getByText('CommandFailureNotices.createGame.title')).toBeVisible();
  act(() => store.dispatch(server.Actions.clearStore()));
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('CommandFailure.disconnected')).toBeVisible();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps a shutdown reason received in the same batch as disconnection', () => {
  const store = setup();
  act(() => {
    store.dispatch(server.Actions.serverShutdown({ data: create(Event_ServerShutdownSchema, { reason: 'Maintenance', minutes: 0 }) }));
    store.dispatch(disconnect());
  });
  expect(screen.getByText(/Maintenance/)).toBeVisible();
  act(() => store.dispatch(server.Actions.clearStore()));
  expect(screen.getByText(/Maintenance/)).toBeVisible();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each([disconnect, server.Actions.clearStore])('clears idle warnings but retains server messages at boundary %s', (boundary) => {
  const store = setup();
  act(() => {
    store.dispatch(server.Actions.notifyUser({ notification: create(Event_NotifyUserSchema, {
      type: Event_NotifyUser_NotificationType.IDLEWARNING,
    }) }));
    store.dispatch(warning());
  });
  expect(screen.getByText('ServerNotices.idle.title')).toBeVisible();
  act(() => store.dispatch(boundary()));
  expect(screen.queryByText('ServerNotices.idle.title')).not.toBeInTheDocument();
  expect(screen.getByText(/Banned: repeated abuse/)).toBeVisible();
});

it('retains the connection-closed reason when a later socket status replaces it', () => {
  const store = setup();
  act(() => {
    store.dispatch(server.Actions.updateStatus({ status: {
      state: WebsocketTypes.StatusEnum.DISCONNECTED, description: 'You are banned until tomorrow',
    } }));
    store.dispatch(server.Actions.updateStatus({ status: {
      state: WebsocketTypes.StatusEnum.DISCONNECTED, description: 'Connection Closed',
    } }));
    store.dispatch(server.Actions.clearStore());
  });
  expect(screen.getByText('You are banned until tomorrow')).toBeVisible();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each(['Connection Closed', 'Connection Failed', null])('does not add a dialog for generic transport status %s', (description) => {
  const store = setup();
  act(() => store.dispatch(server.Actions.updateStatus({
    status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description },
  })));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
