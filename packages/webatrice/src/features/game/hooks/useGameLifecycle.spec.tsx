import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { games } from '@cockatrice/datatrice';

import { actionReducer } from '../../../store/actions/actionReducer';

import { useGameLifecycle } from './useGameLifecycle';

function makeStore() {
  return configureStore({
    reducer: combineReducers({ games: games.gamesReducer, action: actionReducer }),
  });
}

function wrap(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useGameLifecycle', () => {
  it('invokes onKicked when a kicked action targets this gameId', () => {
    const store = makeStore();
    const onKicked = vi.fn();
    const onGameClosed = vi.fn();
    const onGameLeft = vi.fn();

    renderHook(
      () => useGameLifecycle(42, { onKicked, onGameClosed, onGameLeft }),
      { wrapper: wrap(store) },
    );

    act(() => {
      store.dispatch({ type: games.Types.KICKED, payload: { gameId: 42 } });
    });

    expect(onKicked).toHaveBeenCalledTimes(1);
    expect(onGameClosed).not.toHaveBeenCalled();
    expect(onGameLeft).not.toHaveBeenCalled();
  });

  it('invokes onGameClosed when a gameClosed action targets this gameId', () => {
    const store = makeStore();
    const onKicked = vi.fn();
    const onGameClosed = vi.fn();
    const onGameLeft = vi.fn();

    renderHook(
      () => useGameLifecycle(42, { onKicked, onGameClosed, onGameLeft }),
      { wrapper: wrap(store) },
    );

    act(() => {
      store.dispatch({ type: games.Types.GAME_CLOSED, payload: { gameId: 42 } });
    });

    expect(onGameClosed).toHaveBeenCalledTimes(1);
    expect(onKicked).not.toHaveBeenCalled();
    expect(onGameLeft).not.toHaveBeenCalled();
  });

  it('invokes onGameLeft when a gameLeft action targets this gameId', () => {
    const store = makeStore();
    const onKicked = vi.fn();
    const onGameClosed = vi.fn();
    const onGameLeft = vi.fn();

    renderHook(
      () => useGameLifecycle(42, { onKicked, onGameClosed, onGameLeft }),
      { wrapper: wrap(store) },
    );

    act(() => {
      store.dispatch({ type: games.Types.GAME_LEFT, payload: { gameId: 42 } });
    });

    expect(onGameLeft).toHaveBeenCalledTimes(1);
    expect(onKicked).not.toHaveBeenCalled();
    expect(onGameClosed).not.toHaveBeenCalled();
  });

  it('ignores lifecycle actions for a different gameId', () => {
    const store = makeStore();
    const onKicked = vi.fn();
    const onGameClosed = vi.fn();
    const onGameLeft = vi.fn();

    renderHook(
      () => useGameLifecycle(42, { onKicked, onGameClosed, onGameLeft }),
      { wrapper: wrap(store) },
    );

    act(() => {
      store.dispatch({ type: games.Types.KICKED, payload: { gameId: 7 } });
      store.dispatch({ type: games.Types.GAME_CLOSED, payload: { gameId: 7 } });
      store.dispatch({ type: games.Types.GAME_LEFT, payload: { gameId: 7 } });
    });

    expect(onKicked).not.toHaveBeenCalled();
    expect(onGameClosed).not.toHaveBeenCalled();
    expect(onGameLeft).not.toHaveBeenCalled();
  });

  it('is inert when gameId is undefined', () => {
    const store = makeStore();
    const onKicked = vi.fn();
    const onGameClosed = vi.fn();
    const onGameLeft = vi.fn();

    renderHook(
      () => useGameLifecycle(undefined, { onKicked, onGameClosed, onGameLeft }),
      { wrapper: wrap(store) },
    );

    act(() => {
      store.dispatch({ type: games.Types.KICKED, payload: { gameId: 42 } });
      store.dispatch({ type: games.Types.GAME_CLOSED, payload: { gameId: 42 } });
      store.dispatch({ type: games.Types.GAME_LEFT, payload: { gameId: 42 } });
    });

    expect(onKicked).not.toHaveBeenCalled();
    expect(onGameClosed).not.toHaveBeenCalled();
    expect(onGameLeft).not.toHaveBeenCalled();
  });

  it('ignores unrelated action types', () => {
    const store = makeStore();
    const onKicked = vi.fn();
    const onGameClosed = vi.fn();
    const onGameLeft = vi.fn();

    renderHook(
      () => useGameLifecycle(42, { onKicked, onGameClosed, onGameLeft }),
      { wrapper: wrap(store) },
    );

    act(() => {
      store.dispatch({ type: games.Types.GAME_HOST_CHANGED, payload: { gameId: 42, hostId: 7 } });
    });

    expect(onKicked).not.toHaveBeenCalled();
    expect(onGameClosed).not.toHaveBeenCalled();
    expect(onGameLeft).not.toHaveBeenCalled();
  });
});
