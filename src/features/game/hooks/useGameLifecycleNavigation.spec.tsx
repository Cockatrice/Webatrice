import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { games } from '@cockatrice/datatrice';

import { actionReducer } from '../../../store/actions/actionReducer';
import { ToastProvider } from '../../../components/Toast/ToastContext';
import { RouteEnum } from '../../../types/routes';
import { useGameLifecycleNavigation } from './useGameLifecycleNavigation';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

function makeStore() {
  return configureStore({
    reducer: combineReducers({ games: games.gamesReducer, action: actionReducer }),
  });
}

function wrap(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter>
          <ToastProvider>{children}</ToastProvider>
        </MemoryRouter>
      </Provider>
    );
  };
}

describe('useGameLifecycleNavigation', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('navigates to SERVER when the user is kicked from the matching game', () => {
    const store = makeStore();
    renderHook(() => useGameLifecycleNavigation(42), { wrapper: wrap(store) });

    act(() => {
      store.dispatch({ type: games.Types.KICKED, payload: { gameId: 42 } });
    });

    expect(navigateMock).toHaveBeenCalledWith(RouteEnum.SERVER);
  });

  it('navigates to SERVER when the host closes the game', () => {
    const store = makeStore();
    renderHook(() => useGameLifecycleNavigation(42), { wrapper: wrap(store) });

    act(() => {
      store.dispatch({ type: games.Types.GAME_CLOSED, payload: { gameId: 42 } });
    });

    expect(navigateMock).toHaveBeenCalledWith(RouteEnum.SERVER);
  });

  it('navigates to SERVER on gameLeft', () => {
    const store = makeStore();
    renderHook(() => useGameLifecycleNavigation(42), { wrapper: wrap(store) });

    act(() => {
      store.dispatch({ type: games.Types.GAME_LEFT, payload: { gameId: 42 } });
    });

    expect(navigateMock).toHaveBeenCalledWith(RouteEnum.SERVER);
  });

  it('ignores lifecycle events for a different gameId', () => {
    const store = makeStore();
    renderHook(() => useGameLifecycleNavigation(42), { wrapper: wrap(store) });

    act(() => {
      store.dispatch({ type: games.Types.KICKED, payload: { gameId: 7 } });
      store.dispatch({ type: games.Types.GAME_CLOSED, payload: { gameId: 7 } });
      store.dispatch({ type: games.Types.GAME_LEFT, payload: { gameId: 7 } });
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('is inert when gameId is undefined', () => {
    const store = makeStore();
    renderHook(() => useGameLifecycleNavigation(undefined), { wrapper: wrap(store) });

    act(() => {
      store.dispatch({ type: games.Types.KICKED, payload: { gameId: 42 } });
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
