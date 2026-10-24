import { ZoneName } from '@cockatrice/sockatrice';
import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { createStore } from '@cockatrice/datatrice';

import { createMockWebClient } from '../../../__test-utils__/mockWebClient';
import { ToastProvider } from '../../../components/Toast/ToastContext';

vi.mock('../../../hooks/useSettings');

vi.mock('@app/feature-widgets/shortcuts', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@app/feature-widgets/shortcuts')
  >();
  return {
    ...actual,
    useShortcut: () => undefined,
  };
});

import { useGame } from './useGame';

interface SetupOpts {
  routeGameId?: string;
  spectator?: boolean;
  judge?: boolean;
  spectatorsOmniscient?: boolean;
  started?: boolean;
  readyStart?: boolean;
  includeLocalPlayer?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const {
    routeGameId = '1',
    spectator = false,
    judge = false,
    spectatorsOmniscient = false,
    started = true,
    readyStart = false,
    includeLocalPlayer = true,
  } = opts;

  const localPlayerId = 7;
  const players: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  if (includeLocalPlayer) {
    players[localPlayerId] = makePlayerEntry({
      properties: makePlayerProperties({ playerId: localPlayerId, readyStart }),
      zones: {
        [ZoneName.HAND]: makeZoneEntry({ name: ZoneName.HAND }),
        [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK }),
        [ZoneName.TABLE]: makeZoneEntry({ name: ZoneName.TABLE }),
      },
    });
  }
  players[8] = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 8 }),
  });

  const game = makeGameEntry({
    localPlayerId,
    started,
    spectator,
    judge,
    players,
  });
  const withInfo = {
    ...game,
    info: { ...game.info, gameId: 1, spectatorsOmniscient },
  };
  const gamesState: GamesState = { games: { 1: withInfo, 2: { ...withInfo, info: { ...withInfo.info, gameId: 2 } } }, pings: {} };

  const webClient = createMockWebClient();
  const reducer = combineReducers({ games: games.gamesReducer });
  const store = createStore({
    reducer: reducer as never,
    preloadedState: { games: gamesState } as never,
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <MemoryRouter initialEntries={[`/game/${routeGameId}`]}>
            <ToastProvider>
              <Routes>
                <Route path='/game/:gameId' element={children} />
                <Route path='/server' element={children} />
              </Routes>
            </ToastProvider>
          </MemoryRouter>
        </WebClientContext>
      </Provider>
    );
  }

  const hook = renderHook(({ gameId }: { gameId?: number }) => useGame({ gameId }), {
    wrapper: Wrapper, initialProps: { gameId: undefined },
  });
  return { ...hook, webClient, Wrapper, store };
}

describe('useGame', () => {
  it('reads the gameId from the route param and surfaces the game shape', () => {
    const { result } = setup();

    expect(result.current.gameId).toBe(1);
    expect(result.current.game).toBeDefined();
    expect(result.current.isStarted).toBe(true);
    expect(result.current.localPlayer).toBeDefined();
    expect(result.current.boardRef.current).toBeNull();
    expect(result.current.sensors).toBeDefined();
  });

  it('retains each game rotation across switches and route remounts', () => {
    const { result, rerender, unmount, Wrapper } = setup();
    const original = result.current.layout.cells.map((cell) => cell.playerId);
    act(() => result.current.rotateView(1));
    const rotated = result.current.layout.cells.map((cell) => cell.playerId);
    expect(rotated).not.toEqual(original);

    rerender({ gameId: 2 });
    expect(result.current.layout.cells.map((cell) => cell.playerId)).toEqual(original);
    act(() => result.current.rotateView(-1));
    rerender({ gameId: 1 });
    expect(result.current.layout.cells.map((cell) => cell.playerId)).toEqual(rotated);

    unmount();
    const remounted = renderHook(() => useGame({ gameId: 1 }), { wrapper: Wrapper });
    expect(remounted.result.current.layout.cells.map((cell) => cell.playerId)).toEqual(rotated);
  });

  // The deck-select open predicate moved into useDeckSelectDialog (so the dialog
  // self-gates); its open/closed cases are covered in useDeckSelectDialog.spec.

  // Hand visibility (bar vs inline, omniscient reveal) is owned by the board
  // view-model and covered in useGameBoardLayout.spec.ts.
});
