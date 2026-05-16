import { renderHook, act } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeArrow,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeUser,
} from '@cockatrice/datatrice/testing';

vi.mock('../../../../../hooks/useSettings');

import { useSettings } from '../../../../../hooks/useSettings';
import { makeSettings, makeSettingsHook } from '../../../../../hooks/__mocks__/useSettings';
import { LoadingState } from '../../../../../hooks/useSharedStore';
import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import { useTurnControls } from './useTurnControls';

function stateWith({
  localPlayerId = 1,
  activePlayerId = 1,
  hostId = 1,
  started = true,
  conceded = false,
  spectator = false,
  judge = false,
  opponentIds = [] as number[],
  arrows = {} as Record<number, ReturnType<typeof makeArrow>>,
}: {
  localPlayerId?: number;
  activePlayerId?: number;
  hostId?: number;
  started?: boolean;
  conceded?: boolean;
  spectator?: boolean;
  judge?: boolean;
  opponentIds?: number[];
  arrows?: Record<number, ReturnType<typeof makeArrow>>;
} = {}): GamesState {
  const players: Record<number, ReturnType<typeof makePlayerEntry>> = {
    [localPlayerId]: makePlayerEntry({
      properties: makePlayerProperties({
        playerId: localPlayerId,
        userInfo: makeUser({ name: `P${localPlayerId}` }),
        conceded,
      }),
      arrows,
    }),
  };
  for (const id of opponentIds) {
    players[id] = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: id,
        userInfo: makeUser({ name: `P${id}` }),
      }),
    });
  }
  return {
    games: {
      1: makeGameEntry({
        localPlayerId,
        activePlayerId,
        hostId,
        started,
        spectator,
        judge,
        players,
      }),
    },
  };
}

interface SetupOpts {
  state?: GamesState;
  gameId?: number | undefined;
}

function setup(opts: SetupOpts = {}) {
  const state: GamesState = opts.state ?? stateWith();
  const gameId: number | undefined = 'gameId' in opts ? opts.gameId : 1;
  const onRequestConcede = vi.fn();
  const onRequestUnconcede = vi.fn();
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: state },
  });
  const { result } = renderHook(
    () => useTurnControls({ gameId, onRequestConcede, onRequestUnconcede }),
    { wrapper: Wrapper },
  );
  return { result, webClient, onRequestConcede, onRequestUnconcede };
}

beforeEach(() => {
  vi.mocked(useSettings).mockReturnValue(makeSettingsHook());
});

describe('useTurnControls', () => {
  it('lists opponents and gates kick on host-with-opponents', () => {
    const { result } = setup({ state: stateWith({ opponentIds: [2, 3], hostId: 1 }) });

    expect(result.current.opponents.map((o) => o.playerId).sort()).toEqual([2, 3]);
    expect(result.current.canKick).toBe(true);
    expect(result.current.isHost).toBe(true);
  });

  it('canKick is false when the local player is not host', () => {
    const { result } = setup({ state: stateWith({ opponentIds: [2], hostId: 2 }) });

    expect(result.current.canKick).toBe(false);
    expect(result.current.isHost).toBe(false);
  });

  it('handlePassTurn dispatches nextTurn and handleNextPhase advances from a pre-game phase to Untap (0)', () => {
    const { result, webClient } = setup({
      state: { games: { 1: { ...stateWith().games[1], activePhase: -1 } } },
    });

    act(() => {
      result.current.handlePassTurn();
    });
    act(() => {
      result.current.handleNextPhase();
    });

    expect(webClient.request.game.nextTurn).toHaveBeenCalledWith(1);
    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(1, { phase: 0 });
  });

  it('handleConcedeToggle routes to onRequestConcede or onRequestUnconcede based on conceded state', () => {
    const live = setup({ state: stateWith({ conceded: false }) });
    act(() => {
      live.result.current.handleConcedeToggle();
    });
    expect(live.onRequestConcede).toHaveBeenCalledTimes(1);
    expect(live.onRequestUnconcede).not.toHaveBeenCalled();

    const conceded = setup({ state: stateWith({ conceded: true }) });
    act(() => {
      conceded.result.current.handleConcedeToggle();
    });
    expect(conceded.onRequestUnconcede).toHaveBeenCalledTimes(1);
    expect(conceded.onRequestConcede).not.toHaveBeenCalled();
  });

  it('handleRemoveArrows deletes every local arrow', () => {
    const { result, webClient } = setup({
      state: stateWith({
        arrows: {
          11: makeArrow({ id: 11 }),
          12: makeArrow({ id: 12 }),
        },
      }),
    });

    expect(result.current.canRemoveArrows).toBe(true);
    act(() => {
      result.current.handleRemoveArrows();
    });

    expect(webClient.request.game.deleteArrow).toHaveBeenCalledTimes(2);
    expect(webClient.request.game.deleteArrow).toHaveBeenCalledWith(1, { arrowId: 11 });
    expect(webClient.request.game.deleteArrow).toHaveBeenCalledWith(1, { arrowId: 12 });
  });

  it('all turn actions no-op when there is no live game (gameId undefined)', () => {
    const { result, webClient, onRequestConcede } = setup({ gameId: undefined });

    expect(result.current.hasLiveGame).toBe(false);
    expect(result.current.canPassTurn).toBe(false);
    expect(result.current.canKick).toBe(false);

    act(() => {
      result.current.handlePassTurn();
      result.current.handleNextPhase();
      result.current.handleConcedeToggle();
      result.current.handleRemoveArrows();
      result.current.handleKick(2);
    });

    expect(webClient.request.game.nextTurn).not.toHaveBeenCalled();
    expect(webClient.request.game.setActivePhase).not.toHaveBeenCalled();
    expect(webClient.request.game.deleteArrow).not.toHaveBeenCalled();
    expect(webClient.request.game.kickFromGame).not.toHaveBeenCalled();
    expect(onRequestConcede).not.toHaveBeenCalled();
  });

  it('handleToggleInvert calls updateSettings when settings are ready, no-ops otherwise', () => {
    const updateReady = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({
        status: LoadingState.READY,
        value: makeSettings({ invertVerticalCoordinate: false }),
        update: updateReady,
      }),
    );
    const ready = setup();
    act(() => {
      ready.result.current.handleToggleInvert();
    });
    expect(updateReady).toHaveBeenCalledWith({ invertVerticalCoordinate: true });

    const updateBusy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({
        status: LoadingState.LOADING,
        value: makeSettings({ invertVerticalCoordinate: false }),
        update: updateBusy,
      }),
    );
    const busy = setup();
    act(() => {
      busy.result.current.handleToggleInvert();
    });
    expect(updateBusy).not.toHaveBeenCalled();
  });
});
