import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { useGameAffordances } from './useGameAffordances';

function makeWrapper(gamesState: GamesState) {
  const store = configureStore({
    reducer: { games: games.gamesReducer },
    preloadedState: { games: gamesState } as { games: GamesState },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useGameAffordances', () => {
  it('returns the all-false shape when no game is active', () => {
    const wrapper = makeWrapper({ games: {} });
    const { result } = renderHook(() => useGameAffordances(undefined), { wrapper });

    expect(result.current.hasLiveGame).toBe(false);
    expect(result.current.isParticipant).toBe(false);
    expect(result.current.canPassTurn).toBe(false);
    expect(result.current.canAdvancePhase).toBe(false);
    expect(result.current.canConcede).toBe(false);
    expect(result.current.canUnconcede).toBe(false);
    expect(result.current.canRoll).toBe(false);
  });

  it('grants the full participant action set when the local player is started and active', () => {
    const game = makeGameEntry({
      localPlayerId: 7,
      started: true,
      activePlayerId: 7,
      players: {
        7: makePlayerEntry({
          properties: makePlayerProperties({ playerId: 7, conceded: false }),
        }),
      },
    });
    const wrapper = makeWrapper({ games: { 1: { ...game, info: { ...game.info, gameId: 1 } } } });

    const { result } = renderHook(() => useGameAffordances(1), { wrapper });

    expect(result.current.hasLiveGame).toBe(true);
    expect(result.current.isParticipant).toBe(true);
    expect(result.current.isStarted).toBe(true);
    expect(result.current.canPassTurn).toBe(true);
    expect(result.current.canAdvancePhase).toBe(true);
    expect(result.current.canConcede).toBe(true);
    expect(result.current.canUnconcede).toBe(false);
    expect(result.current.canRoll).toBe(true);
  });

  it('flips concede/unconcede when the local player has conceded', () => {
    const game = makeGameEntry({
      localPlayerId: 7,
      started: true,
      activePlayerId: 7,
      players: {
        7: makePlayerEntry({
          properties: makePlayerProperties({ playerId: 7, conceded: true }),
        }),
      },
    });
    const wrapper = makeWrapper({ games: { 1: { ...game, info: { ...game.info, gameId: 1 } } } });

    const { result } = renderHook(() => useGameAffordances(1), { wrapper });

    expect(result.current.isConceded).toBe(true);
    expect(result.current.canConcede).toBe(false);
    expect(result.current.canUnconcede).toBe(true);
    expect(result.current.canPassTurn).toBe(false);
  });

  it('locks participant-only actions for spectators but still allows rolling', () => {
    const game = makeGameEntry({ localPlayerId: 7, spectator: true, started: true });
    const wrapper = makeWrapper({ games: { 1: { ...game, info: { ...game.info, gameId: 1 } } } });

    const { result } = renderHook(() => useGameAffordances(1), { wrapper });

    expect(result.current.isParticipant).toBe(false);
    expect(result.current.canConcede).toBe(false);
    expect(result.current.canUnconcede).toBe(false);
    expect(result.current.canPassTurn).toBe(false);
    expect(result.current.canAdvancePhase).toBe(false);
    expect(result.current.canRoll).toBe(false);
  });

  it('treats a judge as canAdvancePhase/canPassTurn even when not the active player', () => {
    const game = makeGameEntry({
      localPlayerId: 7,
      judge: true,
      spectator: true,
      started: true,
      activePlayerId: 99,
    });
    const wrapper = makeWrapper({ games: { 1: { ...game, info: { ...game.info, gameId: 1 } } } });

    const { result } = renderHook(() => useGameAffordances(1), { wrapper });

    expect(result.current.canAdvancePhase).toBe(true);
    expect(result.current.canPassTurn).toBe(true);
    expect(result.current.canRoll).toBe(true);
  });
});
