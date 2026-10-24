import { create } from '@bufbuild/protobuf';
import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { Mock } from 'vitest';

import { server } from '@cockatrice/datatrice';
import { Response_GetServerStatsSchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../__test-utils__';
import Developer from './Developer';

const { IsRegistered, IsDeveloper, IsModerator } = ServerInfo_User_UserLevelFlag;

const statsFailed = (failure?: WebsocketTypes.CommandFailure) =>
  server.Actions.developerCommandFailed({ command: 'getServerStats', responseCode: 7, target: '', failure });

function setup(userLevel = IsRegistered | IsDeveloper, version = '3.1.0 ()') {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(
    <Routes>
      <Route path="/server" element={<div>server-page</div>} />
      <Route path="/developer" element={<Developer />} />
    </Routes>,
    {
      preloadedState: {
        ...connectedState,
        server: {
          ...(connectedState.server as any),
          info: { message: null, name: 'Servatrice', version },
          user: makeUser({ userLevel }),
        },
      },
      route: '/developer',
      webClient,
    },
  );
  return { ...utils, webClient, getServerStats: webClient.request.developer.getServerStats as unknown as Mock };
}

describe('Developer', () => {
  it('is offered only to developers', () => {
    setup(IsRegistered | IsModerator);
    expect(screen.getByText('server-page')).toBeInTheDocument();
  });

  it('is unavailable on a 3.0 server', () => {
    setup(IsRegistered | IsDeveloper, '3.0.0 ()');
    expect(screen.getByText('server-page')).toBeInTheDocument();
  });

  it('requests nothing until refreshed, then shows the snapshot', () => {
    const { getServerStats, store } = setup();
    expect(getServerStats).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /button\.refresh/ }));
    expect(getServerStats).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(server.Actions.serverStats({ stats: create(Response_GetServerStatsSchema, { gamesCount: 7n }) }));
    });
    expect(screen.getByText('Developer.stat.gamesRunning')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/^Developer\.status\.updated/)).toBeInTheDocument();
  });

  it('skips a refresh while one is pending, and reports a failure', () => {
    const { getServerStats, store } = setup();
    const refresh = screen.getByRole('button', { name: /button\.refresh/ });
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    expect(getServerStats).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(statsFailed());
    });
    expect(screen.getByText('Developer.status.unavailable')).toBeInTheDocument();

    fireEvent.click(refresh);
    expect(getServerStats).toHaveBeenCalledTimes(2);
  });

  it('auto-refreshes at the chosen interval once enabled', () => {
    vi.useFakeTimers();
    try {
      const { getServerStats, store } = setup();
      const interval = screen.getByRole('spinbutton', { name: /autoRefresh\.interval/ });
      expect(interval).toBeDisabled();

      fireEvent.click(screen.getByRole('checkbox', { name: /autoRefresh\.label/ }));
      expect(getServerStats).toHaveBeenCalledTimes(1);
      act(() => {
        store.dispatch(statsFailed());
      });

      fireEvent.change(interval, { target: { value: '2' } });
      fireEvent.blur(interval);
      expect(interval).toHaveValue(5);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(getServerStats).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says why the stats are missing when the server never answered', () => {
    const { store } = setup();
    fireEvent.click(screen.getByRole('button', { name: /button\.refresh/ }));
    act(() => {
      store.dispatch(statsFailed(WebsocketTypes.CommandFailure.Disconnected));
    });
    expect(screen.getByText('CommandFailure.disconnected')).toBeInTheDocument();
  });
});
