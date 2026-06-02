import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { games, type GamesState } from '@cockatrice/datatrice';
import { makeGameEntry } from '@cockatrice/datatrice/testing';
import { useJudgeTarget } from './useJudgeTarget';

function makeWrapper(gamesState: GamesState) {
  const store = configureStore({
    reducer: { games: games.gamesReducer },
    preloadedState: { games: gamesState } as { games: GamesState },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

function resolver(opts: { localPlayerId: number; judge: boolean }) {
  const game = makeGameEntry({ localPlayerId: opts.localPlayerId, spectator: false, judge: opts.judge });
  const wrapper = makeWrapper({ games: { 1: game } } as unknown as GamesState);
  return renderHook(() => useJudgeTarget(1), { wrapper }).result.current;
}

describe('useJudgeTarget', () => {
  it('returns the owner when a judge acts on a card they do not own', () => {
    expect(resolver({ localPlayerId: 1, judge: true })(2)).toBe(2);
  });

  it('returns undefined for a judge acting on their own card (sent bare)', () => {
    expect(resolver({ localPlayerId: 1, judge: true })(1)).toBeUndefined();
  });

  it('returns undefined for a non-judge, even on a foreign card', () => {
    expect(resolver({ localPlayerId: 1, judge: false })(2)).toBeUndefined();
  });

  it('returns 0 for a judge acting on player 0 (player 0 is a valid target, not falsy-skipped)', () => {
    expect(resolver({ localPlayerId: 1, judge: true })(0)).toBe(0);
  });

  it('returns undefined when there is no game', () => {
    const wrapper = makeWrapper({ games: {} } as GamesState);
    expect(renderHook(() => useJudgeTarget(1), { wrapper }).result.current(2)).toBeUndefined();
  });
});
