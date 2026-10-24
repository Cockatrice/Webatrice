import { create } from '@bufbuild/protobuf';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games, server } from '@cockatrice/datatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeServerState } from '@cockatrice/datatrice/testing';
import { ServerInfo_PlayerPropertiesSchema } from '@cockatrice/sockatrice/generated';
import { DEFAULT_PLAYMAT_SETTINGS, PlaymatFallbackBehavior, PlaymatMode, setPlaymatSettings, settingsStore } from '@app/hooks';
import { SettingDTO } from '@app/services';
import { actionReducer } from '../../../store/actions';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { clearPlaymatSyncState, getPlaymatSyncState } from './playmatSyncState';
import { usePlaymatSync } from './usePlaymatSync';

const params = { marginPctL: 0.07, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 };
const mat = (cardName: string) => ({ cardName, cardProviderId: '', params });

function setup({ version = '3.1.0 ()', spectator = false, replay = false } = {}) {
  const { Wrapper, store, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer, server: server.serverReducer, action: actionReducer }),
    preloadedState: {
      games: { games: { 1: makeGameEntry({ localPlayerId: 1, spectator, replay,
        players: { 1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1 }) }) },
      }) }, pings: { 1: {} } },
      server: makeServerState({ info: { message: null, name: 'Servatrice', version } }),
    } as any,
  });
  const hook = renderHook(() => usePlaymatSync(), { wrapper: Wrapper });
  const announce = (patch: Parameters<typeof create<typeof ServerInfo_PlayerPropertiesSchema>>[1], isDeckSelect = false) => {
    act(() => {
      const properties = create(ServerInfo_PlayerPropertiesSchema, patch);
      store.dispatch(games.Actions.playerPropertiesChanged({ gameId: 1, playerId: 1, properties, isDeckSelect }));
      store.dispatch(games.Actions.playerPropertiesUpdated({ gameId: 1, playerId: 1, properties }));
    });
  };
  const select = (cardName = '') => announce({ deckHash: 'same-hash', playmatParams: { cardName } }, true);
  const started = (gameStarted: boolean) => act(() => {
    store.dispatch(games.Actions.gameInfoUpdated({ gameId: 1, gameStarted }));
  });
  return { hook, store, Wrapper, select, announce, started, send: vi.mocked(webClient.request.game.setPlaymat) };
}

beforeEach(async () => {
  await settingsStore.whenReady();
  settingsStore.setValue(new SettingDTO('*app'));
  clearPlaymatSyncState();
});
afterEach(() => {
  clearPlaymatSyncState(); vi.restoreAllMocks();
});

describe('app-level playmat sync', () => {
  it('observes identical explicit selections separately', () => {
    void setPlaymatSettings({ mode: PlaymatMode.OVERRIDE_DECK,
      fallbackBehavior: PlaymatFallbackBehavior.RANDOM, fallbackList: [mat('A'), mat('B')] });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { select, send } = setup();
    select('Deck');
    select('Deck');
    expect(send.mock.calls.map((call) => call[1].playmatParams?.cardName)).toEqual(['A', 'B']);
  });

  it('keeps announcements separate from deck selections', () => {
    void setPlaymatSettings({ mode: PlaymatMode.OVERRIDE_DECK,
      fallbackBehavior: PlaymatFallbackBehavior.RANDOM, fallbackList: [mat('A'), mat('B')] });
    const { select, announce, send } = setup();
    select('Deck');
    announce({ playmatParams: { cardName: 'unrelated announcement' } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(getPlaymatSyncState(1).deckPlaymat?.cardName).toBe('Deck');
  });

  it('syncs settings and complete start/stop cycles without any Game route mounted', () => {
    void setPlaymatSettings({ fallbackBehavior: PlaymatFallbackBehavior.ROUND_ROBIN, fallbackList: [mat('A'), mat('B')] });
    const { select, announce, started, send } = setup();
    select();
    announce({ playmatParams: { cardName: 'A' } });
    act(() => {
      started(true); started(false);
    });
    announce({ readyStart: true });
    expect(send).toHaveBeenLastCalledWith(1, { playmatParams: { cardName: 'B', cardProviderId: '', ...params } });
    act(() => {
      void setPlaymatSettings({ fallbackList: [mat('C')] });
    });
    expect(send).toHaveBeenLastCalledWith(1, { playmatParams: { cardName: 'C', cardProviderId: '', ...params } });
  });

  it('restores the deck playmat after disabling an override', () => {
    void setPlaymatSettings({ mode: PlaymatMode.OVERRIDE_DECK, fallbackList: [mat('A')] });
    const { select, announce, send } = setup();
    select('Deck');
    announce({ playmatParams: { cardName: 'A' } });
    act(() => {
      void setPlaymatSettings({ mode: PlaymatMode.DECK_ONLY });
    });
    expect(send).toHaveBeenLastCalledWith(1, { playmatParams: { cardName: 'Deck', cardProviderId: '', ...params } });
  });

  it('ignores visibility-only edits and stops listening on teardown', () => {
    void setPlaymatSettings({ fallbackList: [mat('A')] });
    const { hook, select, send } = setup();
    select();
    act(() => {
      void setPlaymatSettings({ visibility: 0 });
    });
    expect(send).toHaveBeenCalledTimes(1);
    hook.unmount();
    act(() => {
      void setPlaymatSettings({ fallbackList: [mat('B')] });
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([{ version: '3.0.0 ()' }, { spectator: true }, { replay: true }])('does not send for %j', (options) => {
    void setPlaymatSettings({ fallbackList: [mat('A')] });
    const { select, send } = setup(options);
    select();
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the deck art in fallback mode and can explicitly clear it', () => {
    const { select, send } = setup();
    select('Deck');
    expect(send).not.toHaveBeenCalled();
    act(() => {
      void setPlaymatSettings({ mode: PlaymatMode.OVERRIDE_DECK, fallbackList: [] });
    });
    expect(send).toHaveBeenCalledExactlyOnceWith(1, { playmatParams: { cardName: '' } });
  });

  it('preserves the deck and round-robin cursor across listener remounts', () => {
    void setPlaymatSettings({ fallbackBehavior: PlaymatFallbackBehavior.ROUND_ROBIN, fallbackList: [mat('A'), mat('B')] });
    const { hook, Wrapper, select, announce, started, send } = setup();
    select();
    announce({ playmatParams: { cardName: 'A' } });
    started(true);
    started(false);
    hook.unmount();
    renderHook(() => usePlaymatSync(), { wrapper: Wrapper });
    expect(send).toHaveBeenCalledTimes(1);
    announce({ readyStart: true });
    expect(send).toHaveBeenLastCalledWith(1, { playmatParams: { cardName: 'B', cardProviderId: '', ...params } });
  });

  it('does not send before a deck is selected', () => {
    void setPlaymatSettings({ ...DEFAULT_PLAYMAT_SETTINGS, fallbackList: [mat('A')] });
    expect(setup().send).not.toHaveBeenCalled();
  });
});
