import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games } from '@cockatrice/datatrice';
import { makeGameEntry } from '@cockatrice/datatrice/testing';

import { makeReduxHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { useGameRotation } from './useGameRotation';

function setupStore() {
  return makeReduxHookWrapper(combineReducers({ games: games.gamesReducer }), {
    games: { games: { 1: makeGameEntry() }, pings: {} },
  });
}

describe('useGameRotation', () => {
  it.each([
    games.Actions.gameLeft({ gameId: 1 }),
    games.Actions.gameClosed({ gameId: 1 }),
    games.Actions.clearStore(),
  ])('discards rotation when the game is removed while unmounted: $type', (action) => {
    const { Wrapper, store } = setupStore();
    const hook = renderHook(() => useGameRotation(1), { wrapper: Wrapper });
    act(() => hook.result.current.rotateView(1));
    expect(hook.result.current.rotationSteps).toBe(1);
    hook.unmount();

    store.dispatch(action);
    const remounted = renderHook(() => useGameRotation(1), { wrapper: Wrapper });
    expect(remounted.result.current.rotationSteps).toBe(0);
  });

  it('shares changes within a store and isolates another store', () => {
    const first = setupStore();
    const second = setupStore();
    const one = renderHook(() => useGameRotation(1), { wrapper: first.Wrapper });
    const same = renderHook(() => useGameRotation(1), { wrapper: first.Wrapper });
    const other = renderHook(() => useGameRotation(1), { wrapper: second.Wrapper });
    act(() => one.result.current.rotateView(-1));
    expect(same.result.current.rotationSteps).toBe(-1);
    expect(other.result.current.rotationSteps).toBe(0);
  });
});
