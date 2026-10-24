import { ZoneName } from '@cockatrice/sockatrice';
import { ServerInfo_Zone_ZoneType } from '@cockatrice/sockatrice/generated';
import { renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games } from '@cockatrice/datatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeZoneEntry } from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { makeDialogTestEnv, makeSetterSpies } from '../../__test-utils__/dialogTestEnv';
import type { ZoneViewTarget } from './gameDialogs.types';
import { useZoneDialogActions } from './useZoneDialogActions';
import { writeShuffleOnClose } from '../../dialogs/shared/zoneViewPreferences';

function makeZonesGame() {
  const zones = (names: NonNullable<Parameters<typeof makeZoneEntry>[0]['name']>[]) =>
    Object.fromEntries(names.map((name) => [name, makeZoneEntry({
      name, cardCount: 0,
      type: name === ZoneName.DECK || name === ZoneName.SIDEBOARD
        ? ServerInfo_Zone_ZoneType.HiddenZone : ServerInfo_Zone_ZoneType.PublicZone,
    })]));
  return makeGameEntry({
    localPlayerId: 1,
    started: true,
    players: {
      1: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 1 }),
        zones: zones([ZoneName.DECK, ZoneName.HAND, ZoneName.GRAVE, ZoneName.EXILE, ZoneName.SIDEBOARD]),
      }),
      2: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 2 }),
        zones: zones([ZoneName.DECK, ZoneName.GRAVE, ZoneName.SIDEBOARD]),
      }),
    },
  });
}

function setup({
  zoneViews = [] as ZoneViewTarget[],
  hasSeat = true,
} = {}) {
  const { env, webClient, game } = makeDialogTestEnv(makeZonesGame());
  const set = makeSetterSpies();
  const { Wrapper, store } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: { games: { 1: game }, pings: {} } },
    webClient,
  });
  const dispatch = vi.spyOn(store, 'dispatch');
  const { result } = renderHook(
    () => useZoneDialogActions({ env, zoneViews, hasSeat, set }),
    { wrapper: Wrapper },
  );
  return { result, set, webClient, dispatch };
}

describe('useZoneDialogActions', () => {
  it('dumps the local library when its view first opens, and not when it is already open', () => {
    const first = setup();
    first.result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });
    expect(first.webClient.request.game.dumpZone).toHaveBeenCalledWith(1, {
      playerId: 1, zoneName: ZoneName.DECK, numberCards: -1, isReversed: false,
    });

    const again = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.DECK }] });
    again.result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });
    expect(again.webClient.request.game.dumpZone).not.toHaveBeenCalled();
  });

  it('shuffles on close only when asked, and always clears the library snapshot', () => {
    const { result, webClient, dispatch } = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.DECK }] });

    result.current.handleCloseZoneView(1, ZoneName.DECK, true);

    expect(webClient.request.game.shuffle).toHaveBeenCalledWith(1, { zoneName: ZoneName.DECK, start: 0, end: -1 });
    expect(dispatch).toHaveBeenCalledWith(games.Actions.zoneViewCleared({ gameId: 1, playerId: 1, zoneName: ZoneName.DECK }));

    const unasked = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.DECK }] });
    unasked.result.current.handleCloseZoneView(1, ZoneName.DECK, false);
    expect(unasked.webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(unasked.dispatch).toHaveBeenCalledWith(
      games.Actions.zoneViewCleared({ gameId: 1, playerId: 1, zoneName: ZoneName.DECK }),
    );
  });

  it('falls back to the remembered "shuffle when closing" choice when closed without one (Esc)', () => {
    const library = { playerId: 1, zoneName: ZoneName.DECK };
    writeShuffleOnClose(false);
    const off = setup({ zoneViews: [library] });
    off.result.current.handleCloseZoneView(1, ZoneName.DECK);
    expect(off.webClient.request.game.shuffle).not.toHaveBeenCalled();

    writeShuffleOnClose(true);
    const on = setup({ zoneViews: [library] });
    on.result.current.handleCloseZoneView(1, ZoneName.DECK);
    expect(on.webClient.request.game.shuffle).toHaveBeenCalledTimes(1);
    window.localStorage.clear();
  });

  it('dumps N cards for a top / bottom view and never shuffles it on close', () => {
    const { result, webClient } = setup();
    result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK, numberCards: 3, isReversed: true });
    expect(webClient.request.game.dumpZone).toHaveBeenCalledWith(1, {
      playerId: 1, zoneName: ZoneName.DECK, numberCards: 3, isReversed: true,
    });

    const top = { playerId: 1, zoneName: ZoneName.DECK, numberCards: 3 };
    const open = setup({ zoneViews: [top] });
    open.result.current.handleCloseZoneView(1, ZoneName.DECK, true);
    expect(open.webClient.request.game.shuffle).not.toHaveBeenCalled();
  });

  it('replaces an open library view of another count through its close path, then dumps afresh', () => {
    writeShuffleOnClose(true);
    const { result, set, webClient, dispatch } = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.DECK }] });
    result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK, numberCards: 5 });

    const update = set.setZoneViews.mock.calls[0][0] as (prev: ZoneViewTarget[]) => ZoneViewTarget[];
    expect(update([{ playerId: 1, zoneName: ZoneName.DECK }])).toEqual([
      { playerId: 1, zoneName: ZoneName.DECK, numberCards: 5 },
    ]);
    const { shuffle, dumpZone } = webClient.request.game;
    expect(shuffle).toHaveBeenCalledWith(1, { zoneName: ZoneName.DECK, start: 0, end: -1 });
    expect(dispatch).toHaveBeenCalledWith(games.Actions.zoneViewCleared({ gameId: 1, playerId: 1, zoneName: ZoneName.DECK }));
    expect(dumpZone).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shuffle).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(dumpZone).mock.invocationCallOrder[0]);
    window.localStorage.clear();
  });

  it('replacing a top-N view never shuffles', () => {
    const { result, webClient } = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.DECK, numberCards: 3 }] });
    result.current.openZoneView({ playerId: 1, zoneName: ZoneName.DECK });

    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(webClient.request.game.dumpZone).toHaveBeenCalledTimes(1);
  });

  it('keeps a view per zone: the exile view opens beside the graveyard view', () => {
    const { result, set } = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.GRAVE }] });
    result.current.openZoneView({ playerId: 1, zoneName: ZoneName.EXILE });

    const update = set.setZoneViews.mock.calls[0][0] as (prev: ZoneViewTarget[]) => ZoneViewTarget[];
    expect(update([{ playerId: 1, zoneName: ZoneName.GRAVE }])).toEqual([
      { playerId: 1, zoneName: ZoneName.GRAVE },
      { playerId: 1, zoneName: ZoneName.EXILE },
    ]);
  });

  it('dumps the sideboard on open and clears it on close, without a shuffle', () => {
    const { result, webClient } = setup();
    result.current.openViewSideboard();
    expect(webClient.request.game.dumpZone).toHaveBeenCalledWith(1, {
      playerId: 1, zoneName: ZoneName.SIDEBOARD, numberCards: -1, isReversed: false,
    });

    const open = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.SIDEBOARD }] });
    open.result.current.handleCloseZoneView(1, ZoneName.SIDEBOARD, true);
    expect(open.webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(open.dispatch).toHaveBeenCalledWith(
      games.Actions.zoneViewCleared({ gameId: 1, playerId: 1, zoneName: ZoneName.SIDEBOARD }),
    );
  });

  it('sends nothing for a public zone or another player\'s zone', () => {
    const { result, webClient, dispatch } = setup({
      zoneViews: [{ playerId: 1, zoneName: ZoneName.GRAVE }, { playerId: 2, zoneName: ZoneName.DECK }],
    });
    result.current.openZoneView({ playerId: 1, zoneName: ZoneName.EXILE });
    result.current.openZoneView({ playerId: 2, zoneName: ZoneName.SIDEBOARD });
    result.current.handleCloseZoneView(1, ZoneName.GRAVE);
    result.current.handleCloseZoneView(2, ZoneName.DECK, true);

    expect(webClient.request.game.dumpZone).not.toHaveBeenCalled();
    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('drops the views of a player or zone that is gone, sending nothing', () => {
    const { set, webClient, dispatch } = setup({
      zoneViews: [{ playerId: 1, zoneName: ZoneName.GRAVE }, { playerId: 3, zoneName: ZoneName.GRAVE }],
    });

    const prune = set.setZoneViews.mock.calls[0][0] as (prev: ZoneViewTarget[]) => ZoneViewTarget[];
    expect(prune([
      { playerId: 1, zoneName: ZoneName.GRAVE },
      { playerId: 3, zoneName: ZoneName.GRAVE },
      { playerId: 2, zoneName: 'nowhere' },
    ])).toEqual([{ playerId: 1, zoneName: ZoneName.GRAVE }]);
    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('leaves the views alone while every zone exists', () => {
    const { set } = setup({ zoneViews: [{ playerId: 1, zoneName: ZoneName.GRAVE }, { playerId: 2, zoneName: ZoneName.DECK }] });
    expect(set.setZoneViews).not.toHaveBeenCalled();
  });

  it('closing a view that is not open sends nothing', () => {
    const { result, set, webClient } = setup();
    result.current.handleCloseZoneView(1, ZoneName.DECK, true);
    expect(set.setZoneViews).not.toHaveBeenCalled();
    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
  });

  it('opens the local seat\'s own views only for a seated player', () => {
    const seated = setup();
    seated.result.current.openViewGraveyard();
    const add = seated.set.setZoneViews.mock.calls[0][0] as (prev: ZoneViewTarget[]) => ZoneViewTarget[];
    expect(add([])).toEqual([{ playerId: 1, zoneName: ZoneName.GRAVE }]);

    const spectator = setup({ hasSeat: false });
    spectator.result.current.openViewLibrary();
    expect(spectator.set.setZoneViews).not.toHaveBeenCalled();
    expect(spectator.webClient.request.game.dumpZone).not.toHaveBeenCalled();
  });

});
