import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { GameSortField, SortDirection } from '@cockatrice/datatrice';

import { rootReducerMap, type RootState } from '../../../store';
import { makeReduxHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { connectedWithRoomsState } from '../../../__test-utils__';
import { useOpenGames } from './useOpenGames';

const reducer = combineReducers(rootReducerMap);

function setup(onActivateGame?: (gameId: number) => void) {
  const { Wrapper, store } = makeReduxHookWrapper(
    reducer as never,
    connectedWithRoomsState as RootState,
  );
  const { result } = renderHook(
    () => useOpenGames({ roomId: 1, onActivateGame }),
    { wrapper: Wrapper },
  );
  return { result, store };
}

describe('useOpenGames', () => {
  it('exposes the sort state, games and selected game id for the room', () => {
    const { result } = setup();

    expect(result.current.sortBy).toEqual({
      field: GameSortField.START_TIME,
      order: SortDirection.DESC,
    });
    expect(Array.isArray(result.current.games)).toBe(true);
    expect(result.current.selectedGameId).toBeUndefined();
  });

  it('handleSort toggles the room game sort order in the store', () => {
    const { result, store } = setup();

    act(() => {
      result.current.handleSort(GameSortField.START_TIME);
    });

    expect(store.getState().rooms.sortGamesBy.field).toBe(GameSortField.START_TIME);
    // START_TIME defaults to DESC; toggling the active field flips it to ASC.
    expect(store.getState().rooms.sortGamesBy.order).toBe(SortDirection.ASC);
  });

  it('handleSelect records the selected game id for the room', () => {
    const { result, store } = setup();

    act(() => {
      result.current.handleSelect(42);
    });

    expect(store.getState().rooms.selectedGameIds[1]).toBe(42);
  });

  it('handleActivate selects the game and invokes onActivateGame', () => {
    const onActivateGame = vi.fn();
    const { result, store } = setup(onActivateGame);

    act(() => {
      result.current.handleActivate(7);
    });

    expect(store.getState().rooms.selectedGameIds[1]).toBe(7);
    expect(onActivateGame).toHaveBeenCalledWith(7);
  });

  it('handleActivate is safe when no onActivateGame callback is provided', () => {
    const { result, store } = setup();

    expect(() => {
      act(() => {
        result.current.handleActivate(9);
      });
    }).not.toThrow();
    expect(store.getState().rooms.selectedGameIds[1]).toBe(9);
  });
});
