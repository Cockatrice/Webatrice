import { ZoneName } from '@cockatrice/sockatrice';
import { ServerInfo_Zone_ZoneType } from '@cockatrice/sockatrice/generated';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';

vi.mock('../../../hooks/useSettings');

import { useGameDialogs } from './useGameDialogs';

interface SetupOpts {
  localPlayerId?: number;
  isSpectator?: boolean;
  judge?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const localPlayerId = opts.localPlayerId ?? 1;
  const isSpectator = opts.isSpectator ?? false;
  const judge = opts.judge ?? false;

  const localPlayer = makePlayerEntry({
    properties: makePlayerProperties({ playerId: localPlayerId }),
    zones: {
      [ZoneName.HAND]: makeZoneEntry({
        name: ZoneName.HAND,
        cardCount: 0,
        order: [],
        byId: {},
      }),
      [ZoneName.DECK]: makeZoneEntry({
        name: ZoneName.DECK,
        type: ServerInfo_Zone_ZoneType.HiddenZone,
        cardCount: 60,
      }),
      [ZoneName.TABLE]: makeZoneEntry({ name: ZoneName.TABLE }),
      [ZoneName.GRAVE]: makeZoneEntry({ name: ZoneName.GRAVE }),
    },
  });

  const opponent = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 2 }),
    zones: { [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK, cardCount: 60 }) },
  });
  const game = makeGameEntry({
    localPlayerId,
    started: true,
    spectator: isSpectator,
    judge,
    players: judge ? { [localPlayerId]: localPlayer, 2: opponent } : { [localPlayerId]: localPlayer },
  });
  const gamesState: GamesState = {
    games: { 1: { ...game, info: { ...game.info, gameId: 1 } } },
    pings: {},
  };

  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const { result } = renderHook(
    () =>
      useGameDialogs({ gameId: 1, isSpectator }),
    { wrapper: Wrapper },
  );

  return {
    result,
    webClient,
    localPlayerId,
  };
}

describe('useGameDialogs', () => {
  it('opens the roll-die dialog via openRollDie and dispatches rollDie on submit', () => {
    const { result, webClient } = setup();

    expect(result.current.rollDieOpen).toBe(false);

    act(() => {
      result.current.openRollDie();
    });
    expect(result.current.rollDieOpen).toBe(true);

    act(() => {
      result.current.handleRollDieSubmit({ sides: 20, count: 3 });
    });

    expect(webClient.request.game.rollDie).toHaveBeenCalledWith(1, { sides: 20, count: 3 });
    expect(result.current.rollDieOpen).toBe(false);
    expect(result.current.lastDieSides).toBe(20);
    expect(result.current.lastDieCount).toBe(3);
  });

  it('routes the concede flow through confirmConcede → webClient.game.concede', () => {
    const { result, webClient } = setup();

    expect(result.current.concedeConfirm).toBeNull();

    act(() => {
      result.current.openConcede();
    });
    expect(result.current.concedeConfirm).toBe('concede');

    act(() => {
      result.current.confirmConcede();
    });

    expect(webClient.request.game.concede).toHaveBeenCalledWith(1);
    expect(result.current.concedeConfirm).toBeNull();
  });

  it('opening the local library view dumps the deck (numberCards -1) to reveal its cards', () => {
    const { result, webClient } = setup({ localPlayerId: 1 });

    act(() => {
      result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });
    });

    expect(result.current.zoneViews).toEqual([{ playerId: 1, zoneName: ZoneName.DECK }]);
    expect(webClient.request.game.dumpZone).toHaveBeenCalledWith(
      1,
      { playerId: 1, zoneName: ZoneName.DECK, numberCards: -1, isReversed: false },
    );
  });

  it('does not re-dump when re-opening an already-open library view', () => {
    const { result, webClient } = setup({ localPlayerId: 1 });

    act(() => {
      result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });
    });
    act(() => {
      result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });
    });

    expect(result.current.zoneViews).toHaveLength(1);
    expect(webClient.request.game.dumpZone).toHaveBeenCalledTimes(1);
  });

  it('does not dump non-deck zones (graveyard view reads existing state)', () => {
    const { result, webClient } = setup({ localPlayerId: 1 });

    act(() => {
      result.current.openZoneView({ playerId: 1, zoneName: ZoneName.GRAVE });
    });

    expect(result.current.zoneViews).toHaveLength(1);
    expect(webClient.request.game.dumpZone).not.toHaveBeenCalled();
  });

  it('closing a library view with shuffle-on-close shuffles the deck and clears the revealed snapshot', () => {
    const { result, webClient } = setup({ localPlayerId: 1 });
    const dispatchSpy = vi.spyOn(games.Actions, 'zoneViewCleared');

    act(() => {
      result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });
    });
    act(() => {
      result.current.handleCloseZoneView(1, ZoneName.DECK, true);
    });

    expect(result.current.zoneViews).toHaveLength(0);
    expect(webClient.request.game.shuffle).toHaveBeenCalledWith(
      1,
      { zoneName: ZoneName.DECK, start: 0, end: -1 },
    );
    expect(dispatchSpy).toHaveBeenCalledWith({ gameId: 1, playerId: 1, zoneName: ZoneName.DECK });
    dispatchSpy.mockRestore();
  });

  it('closing a library view without shuffle-on-close clears but does not shuffle', () => {
    const { result, webClient } = setup({ localPlayerId: 1 });

    act(() => {
      result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });
    });
    act(() => {
      result.current.handleCloseZoneView(1, ZoneName.DECK, false);
    });

    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
  });

  it('closing a non-deck view neither shuffles nor clears', () => {
    const { result, webClient } = setup({ localPlayerId: 1 });
    const dispatchSpy = vi.spyOn(games.Actions, 'zoneViewCleared');

    act(() => {
      result.current.openZoneView({ playerId: 1, zoneName: ZoneName.GRAVE });
    });
    act(() => {
      result.current.handleCloseZoneView(1, ZoneName.GRAVE, true);
    });

    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });
});
