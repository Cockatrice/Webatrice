import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers } from '@reduxjs/toolkit';
import { createStore, server } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { rootReducerMap } from './store';
import { connectedState, createMockWebClient, makeUser } from './__test-utils__';
import { setAdminLocked, useAdminLocked } from './hooks/useAdminLock';
import AppShell from './AppShell';

vi.mock('./AppShellRoutes', () => ({ default: () => null }));

function LockProbe() {
  return <output aria-label="admin lock">{String(useAdminLocked())}</output>;
}

afterEach(() => act(() => setAdminLocked(false)));

it.each(['disconnect', 'clearStore'])('unlocks again on %s, as desktop opens a fresh admin tab', async (teardown) => {
  const store = createStore({ reducer: combineReducers(rootReducerMap), preloadedState: connectedState });
  await act(async () => {
    render(
      <Provider store={store}>
        <WebClientContext value={createMockWebClient()}>
          <AppShell />
          <LockProbe />
        </WebClientContext>
      </Provider>,
    );
  });
  act(() => setAdminLocked(true));
  expect(screen.getByLabelText('admin lock')).toHaveTextContent('true');
  act(() => {
    if (teardown === 'disconnect') {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null } }));
    } else {
      store.dispatch(server.Actions.clearStore());
    }
  });
  expect(screen.getByLabelText('admin lock')).toHaveTextContent('false');
  act(() => {
    store.dispatch(server.Actions.updateUser({
      user: makeUser({ name: 'nextStaff', userLevel: ServerInfo_User_UserLevelFlag.IsModerator }),
    }));
    store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
  });
  expect(screen.getByLabelText('admin lock')).toHaveTextContent('false');
});
