import { renderHook, act } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeCounter,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import { counterCssColor, usePlayerInfoPanel } from './usePlayerInfoPanel';

function stateWith({
  hostId = 1,
  counters = {} as Record<number, ReturnType<typeof makeCounter>>,
}: {
  hostId?: number;
  counters?: Record<number, ReturnType<typeof makeCounter>>;
} = {}): GamesState {
  const player = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 1 }),
    counters,
  });
  const game = makeGameEntry({
    hostId,
    localPlayerId: 1,
    players: { 1: player },
  });
  return { games: { 1: game } };
}

function setup(gamesState: GamesState = stateWith()) {
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });
  const { result } = renderHook(
    () => usePlayerInfoPanel({ gameId: 1, playerId: 1 }),
    { wrapper: Wrapper },
  );
  return { result, webClient };
}

describe('usePlayerInfoPanel', () => {
  it('partitions counters into life vs other and flags the host', () => {
    const life = makeCounter({ id: 1, name: 'Life', count: 20 });
    const white = makeCounter({ id: 2, name: 'W', count: 3 });
    const { result } = setup(stateWith({ counters: { 1: life, 2: white } }));

    expect(result.current.isHost).toBe(true);
    expect(result.current.lifeCounter?.id).toBe(1);
    expect(result.current.otherCounters.map((c) => c.id)).toEqual([2]);
  });

  it('treats name "Life" case-insensitively when picking the life counter', () => {
    const life = makeCounter({ id: 7, name: ' LIFE ', count: 18 });
    const { result } = setup(stateWith({ counters: { 7: life } }));

    expect(result.current.lifeCounter?.id).toBe(7);
    expect(result.current.otherCounters).toHaveLength(0);
  });

  it('reports isHost=false when hostId differs from the panel playerId', () => {
    const { result } = setup(stateWith({ hostId: 99 }));

    expect(result.current.isHost).toBe(false);
  });

  it('handleIncrement dispatches incCounter with the supplied delta', () => {
    const { result, webClient } = setup();

    act(() => {
      result.current.handleIncrement(5, -2);
    });

    expect(webClient.request.game.incCounter).toHaveBeenCalledWith(
      1,
      { counterId: 5, delta: -2 },
    );
  });

  it('counterCssColor falls back to the name-color map when server color is blank', () => {
    expect(counterCssColor({ name: 'W' })).toBe('rgba(245, 245, 220, 1)');
    expect(counterCssColor({ name: 'unknown counter' })).toMatch(/^rgba\(/);
  });
});
