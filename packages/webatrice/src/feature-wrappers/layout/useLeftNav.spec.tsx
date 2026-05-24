import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createStore } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { rootReducerMap, type RootState } from '../../store';
import {
  connectedState,
  connectedWithRoomsState,
  createMockWebClient,
  makeUser,
} from '../../__test-utils__';
import { RouteEnum } from '@app/types';
import { useLeftNav } from './useLeftNav';

const reducer = combineReducers(rootReducerMap);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function setup(preloadedState: Partial<RootState>) {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({
    reducer: reducer as never,
    preloadedState,
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
        </WebClientContext>
      </Provider>
    );
  }
  const { result } = renderHook(() => useLeftNav(), { wrapper: Wrapper });
  return { result, webClient };
}

describe('useLeftNav', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('exposes Account and Replays options for a non-moderator user', () => {
    const { result } = setup(connectedState);

    expect(result.current.isConnected).toBe(true);
    expect(result.current.state.options.map((o) => o.label)).toEqual([
      'Account',
      'Replays',
    ]);
  });

  it('adds Administration and Logs options when the user is a moderator', () => {
    const IsModerator = ServerInfo_User_UserLevelFlag.IsModerator;
    const state = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        user: makeUser({ userLevel: 1 | IsModerator }),
      },
    };
    const { result } = setup(state);

    expect(result.current.state.options.map((o) => o.label)).toContain('Administration');
    expect(result.current.state.options.map((o) => o.label)).toContain('Logs');
  });

  it('handleMenuOpen sets anchorEl and handleMenuClose clears it', () => {
    const { result } = setup(connectedState);
    const anchor = document.createElement('button');

    act(() => {
      result.current.handleMenuOpen({ target: anchor } as never);
    });
    expect(result.current.state.anchorEl).toBe(anchor);

    act(() => {
      result.current.handleMenuClose();
    });
    expect(result.current.state.anchorEl).toBeNull();
  });

  it('handleMenuItemClick navigates to the option route', () => {
    const { result } = setup(connectedState);

    act(() => {
      result.current.handleMenuItemClick({ label: 'Account', route: RouteEnum.ACCOUNT });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/account');
  });

  it('leaveRoom dispatches through the web client and prevents the default event', () => {
    const { result, webClient } = setup(connectedWithRoomsState);
    const preventDefault = vi.fn();

    act(() => {
      result.current.leaveRoom({ preventDefault } as never, 1);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(webClient.request.rooms.leaveRoom).toHaveBeenCalledWith(1);
  });

  it('openImportCardWizard flips the dialog open and closes the menu', () => {
    const { result } = setup(connectedState);

    act(() => {
      result.current.handleMenuOpen({
        target: document.createElement('div'),
      } as never);
    });
    act(() => {
      result.current.openImportCardWizard();
    });

    expect(result.current.state.showCardImportDialog).toBe(true);
    expect(result.current.state.anchorEl).toBeNull();

    act(() => {
      result.current.closeImportCardWizard();
    });
    expect(result.current.state.showCardImportDialog).toBe(false);
  });
});
