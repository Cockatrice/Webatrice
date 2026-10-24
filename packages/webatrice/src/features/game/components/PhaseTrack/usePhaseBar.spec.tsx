import { ZoneName } from '@cockatrice/sockatrice';
import { renderHook, act } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { Phase, games, type GamesState } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { usePhaseBar } from './usePhaseBar';

interface SetupOpts {
  gamesState?: GamesState;
  gameId?: number | undefined;
}

function stateWith({
  activePhase = Phase.Untap,
  localPlayerId = 1,
  activePlayerId = 1,
  started = true,
}: {
  activePhase?: number;
  localPlayerId?: number;
  activePlayerId?: number;
  started?: boolean;
} = {}): GamesState {
  const player = makePlayerEntry({
    properties: makePlayerProperties({ playerId: localPlayerId }),
    zones: {
      [ZoneName.TABLE]: makeZoneEntry({
        name: ZoneName.TABLE,
        type: 1,
        withCoords: true,
      }),
    },
  });
  const game = makeGameEntry({
    started,
    activePhase,
    localPlayerId,
    activePlayerId,
    players: { [localPlayerId]: player },
  });
  return { games: { 1: game }, pings: {} };
}

function setup(opts: SetupOpts = {}) {
  const gamesState: GamesState = opts.gamesState ?? stateWith();
  const gameId: number | undefined = 'gameId' in opts ? opts.gameId : 1;
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });
  const { result } = renderHook(() => usePhaseBar(gameId), { wrapper: Wrapper });
  return { result, webClient };
}

describe('usePhaseBar', () => {
  it('exposes the current activePhase plus passTurn / advancePhase affordances', () => {
    const { result } = setup({ gamesState: stateWith({ activePhase: Phase.FirstMain }) });

    expect(result.current.activePhase).toBe(Phase.FirstMain);
    expect(result.current.canPassTurn).toBe(true);
    expect(result.current.canAdvancePhase).toBe(true);
  });

  it('handlePhaseClick dispatches setActivePhase to the requested phase', () => {
    const { result, webClient } = setup();

    act(() => {
      result.current.handlePhaseClick(Phase.DeclareAttackers);
    });

    // handlePhaseClick now passes an optimistic rollback callback as
    // the third arg — assert the leading positional args, allow the
    // options bag with an onError handler.
    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(
      1,
      { phase: Phase.DeclareAttackers },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it('handlePass dispatches nextTurn and handleDrawOne draws one card', () => {
    const { result, webClient } = setup();

    act(() => {
      result.current.handlePass();
    });
    act(() => {
      result.current.handleDrawOne();
    });

    expect(webClient.request.game.nextTurn).toHaveBeenCalledWith(1);
    expect(webClient.request.game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
  });

  it('handlePassAndUntap forwards and returns the caller request ID', () => {
    const { result, webClient } = setup();
    act(() => {
      expect(result.current.handlePassAndUntap('wrap-request')).toBe('wrap-request');
    });
    expect(webClient.request.game.nextTurn).toHaveBeenCalledWith(1, 'wrap-request');
  });

  it('handleUntapAll emits a single bulk setCardAttr with cardId -1', () => {
    const { result, webClient } = setup();

    act(() => {
      result.current.handleUntapAll();
    });

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      {
        zone: ZoneName.TABLE,
        cardId: -1,
        attribute: CardAttribute.AttrTapped,
        attrValue: '0',
      },
    );
  });

  it('handlePassAndUntap passes the turn, then untaps, even off turn', () => {
    const { result, webClient } = setup({ gamesState: stateWith({ activePlayerId: 2 }) });

    expect(result.current.canAdvancePhase).toBe(false);
    act(() => {
      result.current.handlePassAndUntap();
      result.current.handleReverseTurn();
    });

    expect(webClient.request.game.nextTurn).toHaveBeenCalledWith(1);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(1, expect.objectContaining({ cardId: -1 }));
    expect(vi.mocked(webClient.request.game.nextTurn).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(webClient.request.game.setCardAttr).mock.invocationCallOrder[0]);
  });

  it('handleReverseTurn sends Command_ReverseTurn, off turn too', () => {
    const { result, webClient } = setup({ gamesState: stateWith({ activePlayerId: 2 }) });

    act(() => {
      result.current.handleReverseTurn();
    });

    expect(webClient.request.game.reverseTurn).toHaveBeenCalledWith(1);
  });

  it.each([true, false])('reverse turn exempts a conceded judge: %s', (judge) => {
    const state = stateWith();
    state.games[1].judge = judge;
    state.games[1].players[1].properties.conceded = true;
    const { result, webClient } = setup({ gamesState: state });

    act(() => {
      result.current.handleReverseTurn();
      result.current.handlePass();
    });

    expect(webClient.request.game.reverseTurn).toHaveBeenCalledTimes(judge ? 1 : 0);
    expect(webClient.request.game.nextTurn).not.toHaveBeenCalled();
  });

  it('handleReverseTurn sends nothing before the game starts', () => {
    const { result, webClient } = setup({ gamesState: stateWith({ started: false }) });

    act(() => {
      result.current.handleReverseTurn();
    });

    expect(webClient.request.game.reverseTurn).not.toHaveBeenCalled();
  });

  it('no-ops every action when gameId is undefined', () => {
    const { result, webClient } = setup({ gameId: undefined });

    act(() => {
      result.current.handlePhaseClick(Phase.FirstMain);
      result.current.handlePass();
      result.current.handleDrawOne();
      result.current.handleUntapAll();
      result.current.handlePassAndUntap();
      result.current.handleReverseTurn();
    });

    expect(webClient.request.game.setActivePhase).not.toHaveBeenCalled();
    expect(webClient.request.game.nextTurn).not.toHaveBeenCalled();
    expect(webClient.request.game.reverseTurn).not.toHaveBeenCalled();
    expect(webClient.request.game.drawCards).not.toHaveBeenCalled();
    expect(webClient.request.game.setCardAttr).not.toHaveBeenCalled();
    expect(result.current.canAdvancePhase).toBe(false);
    expect(result.current.canPassTurn).toBe(false);
  });
});
