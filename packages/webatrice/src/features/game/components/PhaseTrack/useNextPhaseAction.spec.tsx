import { ZoneName } from '@cockatrice/sockatrice';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { Phase, games, type GamesState } from '@cockatrice/datatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';

import { actionReducer } from '../../../../store/actions';
import { endSession } from '@app/services/session';

import { makeReduxWebClientHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { useNextPhaseAction } from './useNextPhaseAction';

function setup({ activePhase = Phase.Upkeep as number, activePlayerId = 1, conceded = false, spectator = false } = {}) {
  const game = makeGameEntry({
    started: true,
    activePhase,
    localPlayerId: 1,
    activePlayerId,
    spectator,
    players: { 1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, conceded }) }) },
  });
  const gamesState: GamesState = { games: { 1: game }, pings: {} };
  const { Wrapper, webClient, store } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer, action: actionReducer }),
    preloadedState: { games: gamesState, action: actionReducer(undefined, { type: 'init' }) },
  });
  const { result, unmount } = renderHook(() => useNextPhaseAction(1), { wrapper: Wrapper });
  const order = () => {
    const sent: Array<[string, number]> = [];
    for (const name of ['setActivePhase', 'nextTurn', 'drawCards', 'setCardAttr'] as const) {
      for (const order of vi.mocked(webClient.request.game[name]).mock.invocationCallOrder) {
        sent.push([name, order]);
      }
    }
    return sent.sort((a, b) => a[1] - b[1]).map(([name]) => name);
  };
  return { result, webClient, store, order, Wrapper, unmount };
}

describe('useNextPhaseAction', () => {
  it('Upkeep: sets Draw, then draws one card', () => {
    const { result, webClient, order } = setup({ activePhase: Phase.Upkeep });

    act(() => result.current.run());

    expect(order()).toEqual(['setActivePhase', 'drawCards']);
    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(1, { phase: Phase.Draw }, expect.anything());
    expect(webClient.request.game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
  });

  it('End: passes the turn, then untaps the local table', () => {
    const { result, webClient, order } = setup({ activePhase: Phase.EndCleanup });

    act(() => result.current.run());

    expect(order()).toEqual(['nextTurn', 'setCardAttr']);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(1, {
      zone: ZoneName.TABLE,
      cardId: -1,
      attribute: CardAttribute.AttrTapped,
      attrValue: '0',
    });
  });

  it('a phase without a double-click action only advances', () => {
    const { result, order } = setup({ activePhase: Phase.FirstMain });

    act(() => result.current.run());

    expect(order()).toEqual(['setActivePhase']);
  });

  it('steps from the phase the previous press set, before a re-render', () => {
    const { result, webClient } = setup({ activePhase: Phase.Untap });

    act(() => {
      result.current.run();
      result.current.run();
    });

    expect(vi.mocked(webClient.request.game.setActivePhase).mock.calls.map(([, p]) => p.phase))
      .toEqual([Phase.Upkeep, Phase.Draw]);
  });

  it('End off turn: still passes the turn and untaps, gated on canPassTurn alone (spec §1)', () => {
    const { result, order } = setup({ activePhase: Phase.EndCleanup, activePlayerId: 2 });

    expect(result.current.canRun).toBe(true);
    act(() => result.current.run());

    expect(order()).toEqual(['nextTurn', 'setCardAttr']);
  });

  it('End: a second press before the server answers sends nothing more', () => {
    const { result, order } = setup({ activePhase: Phase.EndCleanup });

    act(() => {
      result.current.run();
      result.current.run();
    });

    expect(order()).toEqual(['nextTurn', 'setCardAttr']);
  });

  it.each(['phase', 'player'])('End: another player changing the %s does not release the wrap', (change) => {
    const { result, store, order } = setup({ activePhase: Phase.EndCleanup, activePlayerId: 2 });
    act(() => result.current.run());
    act(() => {
      store.dispatch(change === 'phase'
        ? games.Actions.activePhaseSet({ gameId: 1, phase: Phase.Upkeep })
        : games.Actions.activePlayerSet({ gameId: 1, activePlayerId: 3 }));
    });
    act(() => store.dispatch(games.Actions.activePhaseSet({ gameId: 1, phase: Phase.EndCleanup })));
    act(() => result.current.run());
    expect(order()).toEqual(['nextTurn', 'setCardAttr']);
  });

  it.each(['success', 'failure'])('End: its own %s releases the wrap', (outcome) => {
    const { result, store, webClient } = setup({ activePhase: Phase.EndCleanup });
    act(() => result.current.run());
    const requestId = vi.mocked(webClient.request.game.nextTurn).mock.calls[0][1];
    act(() => store.dispatch(outcome === 'success'
      ? games.Actions.nextTurnAnswered({ gameId: 1, requestId })
      : games.Actions.nextTurnFailed({ gameId: 1, responseCode: 3, requestId })));
    act(() => result.current.run());
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
    const nextId = vi.mocked(webClient.request.game.nextTurn).mock.calls[1][1];
    expect(requestId).toEqual(expect.any(String));
    expect(nextId).toEqual(expect.any(String));
    expect(nextId).not.toBe(requestId);
  });

  it.each(['success', 'failure'])('End: unrelated or older %s outcomes do not release a newer wrap', (outcome) => {
    const { result, store, webClient } = setup({ activePhase: Phase.EndCleanup });
    const answer = (gameId: number, requestId?: string) => store.dispatch(outcome === 'success'
      ? games.Actions.nextTurnAnswered({ gameId, requestId })
      : games.Actions.nextTurnFailed({ gameId, responseCode: 3, requestId }));
    act(() => result.current.run());
    const firstId = vi.mocked(webClient.request.game.nextTurn).mock.calls[0][1];
    act(() => answer(1, firstId));
    act(() => result.current.run());
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
    const currentId = vi.mocked(webClient.request.game.nextTurn).mock.calls[1][1];
    for (const [gameId, requestId] of [[1, firstId], [1, 'unrelated'], [1, undefined], [2, currentId]] as const) {
      act(() => answer(gameId, requestId));
      act(() => result.current.run());
      expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
    }
  });

  it('End: session end releases the wrap and an old-session answer cannot release its replacement', () => {
    const { result, store, webClient } = setup({ activePhase: Phase.EndCleanup });
    act(() => result.current.run());
    const oldId = vi.mocked(webClient.request.game.nextTurn).mock.calls[0][1];
    act(() => endSession());
    act(() => result.current.run());
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
    act(() => store.dispatch(games.Actions.nextTurnAnswered({ gameId: 1, requestId: oldId })));
    act(() => result.current.run());
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
  });

  it('End: a sibling hook shares the guard and can release it after the sender unmounts', () => {
    const { result, store, webClient, Wrapper, unmount } = setup({ activePhase: Phase.EndCleanup });
    act(() => result.current.run());
    const requestId = vi.mocked(webClient.request.game.nextTurn).mock.calls[0][1];
    const sibling = renderHook(() => useNextPhaseAction(1), { wrapper: Wrapper });
    act(() => sibling.result.current.run());
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(1);
    unmount();
    act(() => store.dispatch(games.Actions.nextTurnAnswered({ gameId: 1, requestId })));
    act(() => sibling.result.current.run());
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
  });

  it('End: simultaneous hooks consume an answer once and keep the replacement wrap guarded', () => {
    const { result, store, webClient, Wrapper } = setup({ activePhase: Phase.EndCleanup });
    const sibling = renderHook(() => useNextPhaseAction(1), { wrapper: Wrapper });
    act(() => result.current.run());
    const requestId = vi.mocked(webClient.request.game.nextTurn).mock.calls[0][1];
    act(() => {
      store.dispatch(games.Actions.nextTurnAnswered({ gameId: 1, requestId }));
      result.current.run();
      sibling.result.current.run();
      store.dispatch(games.Actions.nextTurnAnswered({ gameId: 1, requestId }));
      sibling.result.current.run();
    });
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
  });

  it('End: a synchronous rejection releases the guard registered before sending', () => {
    const { result, store, webClient } = setup({ activePhase: Phase.EndCleanup });
    vi.mocked(webClient.request.game.nextTurn).mockImplementationOnce((gameId, requestId) => {
      store.dispatch(games.Actions.nextTurnFailed({ gameId, requestId, responseCode: 3 }));
    });
    act(() => {
      result.current.run();
      result.current.run();
    });
    expect(webClient.request.game.nextTurn).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['off turn', { activePlayerId: 2 }],
    ['a spectator', { spectator: true, activePlayerId: 2 }],
    ['conceded, at the wrap', { conceded: true, activePhase: Phase.EndCleanup }],
  ])('sends nothing when %s', (_label, opts) => {
    const { result, order } = setup(opts);

    expect(result.current.canRun).toBe(false);
    act(() => result.current.run());

    expect(order()).toEqual([]);
  });
});
