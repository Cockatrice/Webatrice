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

import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
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
  return { games: { 1: game } };
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

    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(
      1,
      { phase: Phase.DeclareAttackers },
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

  it('no-ops every action when gameId is undefined', () => {
    const { result, webClient } = setup({ gameId: undefined });

    act(() => {
      result.current.handlePhaseClick(Phase.FirstMain);
      result.current.handlePass();
      result.current.handleDrawOne();
      result.current.handleUntapAll();
    });

    expect(webClient.request.game.setActivePhase).not.toHaveBeenCalled();
    expect(webClient.request.game.nextTurn).not.toHaveBeenCalled();
    expect(webClient.request.game.drawCards).not.toHaveBeenCalled();
    expect(webClient.request.game.setCardAttr).not.toHaveBeenCalled();
    expect(result.current.canAdvancePhase).toBe(false);
    expect(result.current.canPassTurn).toBe(false);
  });
});
