import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { games, Enriched, type GamesState } from '@cockatrice/datatrice';
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
        [Enriched.ZoneName.HAND]: makeZoneEntry({ name: Enriched.ZoneName.HAND }),
        [Enriched.ZoneName.DECK]: makeZoneEntry({ name: Enriched.ZoneName.DECK }),
        [Enriched.ZoneName.TABLE]: makeZoneEntry({ name: Enriched.ZoneName.TABLE }),
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
  const gamesState: GamesState = { games: { 1: withInfo } };

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

  const { result } = renderHook(() => useGame(), { wrapper: Wrapper });
  return { result, webClient };
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

  it('toggles isRotated when toggleRotated is called', () => {
    const { result } = setup();

    expect(result.current.isRotated).toBe(false);

    act(() => {
      result.current.toggleRotated();
    });
    expect(result.current.isRotated).toBe(true);

    act(() => {
      result.current.toggleRotated();
    });
    expect(result.current.isRotated).toBe(false);
  });

  it('exposes deckSelectOpen=true before game start when local is not ready', () => {
    const { result } = setup({ started: false, readyStart: false });

    expect(result.current.deckSelectOpen).toBe(true);
  });

  it('hides the deck-select once the local player marks ready', () => {
    const { result } = setup({ started: false, readyStart: true });

    expect(result.current.deckSelectOpen).toBe(false);
  });

  it('showHandZone is false for spectators regardless of omniscience', () => {
    const omniscient = setup({ spectator: true, spectatorsOmniscient: true });
    expect(omniscient.result.current.isSpectator).toBe(true);
    expect(omniscient.result.current.showHandZone).toBe(false);

    const blind = setup({ spectator: true, spectatorsOmniscient: false });
    expect(blind.result.current.showHandZone).toBe(false);
  });
});
