import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { createStore, games, rooms } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import {
  ServerInfo_User_UserLevelFlag,
  Event_GameJoinedSchema,
  ServerInfo_GameSchema,
  type ServerInfo_Game,
} from '@cockatrice/sockatrice/generated';

import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { endSession } from '@app/services/session';
import { rootReducerMap, type RootState } from '../store';
import { createMockWebClient, connectedState, makeUser } from '../__test-utils__';
import { useJoinGame, useNavigateOnGameJoined } from './useJoinGame';

import { setAdminLocked } from './useAdminLock';

beforeEach(() => setAdminLocked(false));
afterEach(() => setAdminLocked(false));

const navigateSpy = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate();
      return (...args: Parameters<typeof navigate>) => {
        navigateSpy(...args);
        return navigate(...args);
      };
    },
  };
});

const reducer = combineReducers(rootReducerMap);

function setup<T>(hook: () => T, preloadedState: Partial<RootState> = connectedState) {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({ reducer: reducer as any, preloadedState });
  const location = { pathname: '' };
  function LocationProbe() {
    location.pathname = useLocation().pathname;
    return null;
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <MemoryRouter initialEntries={['/room/1']}>
            <LocationProbe />
            {children}
          </MemoryRouter>
        </WebClientContext>
      </Provider>
    );
  }
  const view = renderHook(hook, { wrapper: Wrapper });
  return { ...view, store, webClient, location, Wrapper };
}

const makeGame = (overrides: MessageInitShape<typeof ServerInfo_GameSchema> = {}): ServerInfo_Game =>
  create(ServerInfo_GameSchema, { gameId: 7, roomId: 2, playerCount: 1, maxPlayers: 2, spectatorsAllowed: true, ...overrides });

describe('useJoinGame', () => {
  it.each([
    [ServerInfo_User_UserLevelFlag.IsModerator, false, true],
    [ServerInfo_User_UserLevelFlag.IsRegistered, true, false],
  ])('skips full-game confirmation for level %i joining as judge: %s', (userLevel, asJudge, overrideRestrictions) => {
    const state = { ...connectedState, server: { ...connectedState.server!, user: makeUser({ userLevel }) } };
    const { result, webClient } = setup(() => useJoinGame(), state);
    act(() => result.current.beginJoin(2, makeGame({ playerCount: 2 }), false, asJudge));
    expect(result.current.spectatorConfirmationRequired).toBe(false);
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({
      spectator: true, joinAsJudge: asJudge, overrideRestrictions,
    }), expect.any(String));
  });

  it('sends Command_JoinGame to the room of the game', () => {
    const { result, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame(), false, false));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(2, {
      gameId: 7, password: '', spectator: false, overrideRestrictions: false, joinAsJudge: false,
    }, expect.any(String));
  });

  it('asks before joining a full game as a spectator and cancels without sending', () => {
    const { result, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame({ playerCount: 2 }), false, false));
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    expect(result.current.spectatorConfirmationRequired).toBe(true);
    act(() => result.current.cancelSpectatorJoin());
    expect(result.current.spectatorConfirmationRequired).toBe(false);
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    act(() => result.current.beginJoin(2, makeGame({ playerCount: 2 }), false, false));
    act(() => result.current.confirmSpectatorJoin());
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({ spectator: true }), expect.any(String));
  });

  it('asks for a required spectator password only after accepting a full game', () => {
    const { result, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame({ playerCount: 2, withPassword: true, spectatorsNeedPassword: true }), false, false));
    expect(result.current.passwordRequired).toBe(false);
    act(() => result.current.confirmSpectatorJoin());
    expect(result.current.passwordRequired).toBe(true);
    act(() => result.current.submitPassword('secret'));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(
      2, expect.objectContaining({ spectator: true, password: 'secret' }), expect.any(String),
    );
  });

  it('asks for the password first and sends it with the join', () => {
    const { result, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame({ withPassword: true }), false, true));
    expect(result.current.passwordRequired).toBe(true);
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();

    act(() => result.current.submitPassword('hunter2'));
    expect(result.current.passwordRequired).toBe(false);
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({
      password: 'hunter2', joinAsJudge: true,
    }), expect.any(String));
  });

  it('does not ask spectators for a password the game does not require of them', () => {
    const { result, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame({ withPassword: true, spectatorsNeedPassword: false }), true, false));
    expect(result.current.passwordRequired).toBe(false);
    expect(webClient.request.rooms.joinGame).toHaveBeenCalled();
  });

  it('cancelling the password prompt sends nothing', () => {
    const { result, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame({ withPassword: true }), false, false));
    act(() => result.current.cancelPassword());
    expect(result.current.passwordRequired).toBe(false);
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
  });

  it('routes to a game that is already open instead of joining it again', () => {
    const state = { ...connectedState, games: { games: { 7: {} as never }, pings: {} } } as Partial<RootState>;
    const { result, webClient, location } = setup(() => useJoinGame(), state);
    act(() => result.current.beginJoin(2, makeGame({ withPassword: true }), false, false));
    expect(result.current.passwordRequired).toBe(false);
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/game/7');
  });
});

describe('useJoinGame request ownership', () => {
  const requestId = (webClient: ReturnType<typeof createMockWebClient>) =>
    vi.mocked(webClient.request.rooms.joinGame).mock.lastCall?.[2];
  const rejectJoin = (store: ReturnType<typeof setup>['store'], id?: string) => act(() => {
    store.dispatch(rooms.Actions.setJoinGameError({ code: 12, message: '', requestId: id }));
  });

  it('reports a rejected join only in the list that sent it', () => {
    const { result, store, webClient } = setup(() => ({ roomList: useJoinGame(), userGames: useJoinGame() }));
    act(() => result.current.userGames.beginJoin(2, makeGame(), false, false));
    const id = requestId(webClient);
    rejectJoin(store, id);
    expect(result.current.userGames.joinError).toEqual({ code: 12, message: '', requestId: id });
    expect(result.current.roomList.joinError).toBeNull();
    expect(id).toEqual(expect.any(String));
  });

  it('owns a synchronous not-sent failure before the command returns', () => {
    const { result, store, webClient } = setup(() => useJoinGame());
    vi.mocked(webClient.request.rooms.joinGame).mockImplementationOnce((_roomId, _params, requestId) => {
      store.dispatch(rooms.Actions.setJoinGameError({
        code: -1, message: '', failure: WebsocketTypes.CommandFailure.NotSent, requestId,
      }));
    });
    act(() => result.current.beginJoin(2, makeGame(), false, false));
    expect(result.current.joinError).toMatchObject({
      failure: WebsocketTypes.CommandFailure.NotSent, requestId: expect.any(String),
    });
  });

  it('ignores an ownerless error in every mounted list', () => {
    const { result, store } = setup(() => ({ a: useJoinGame(), b: useJoinGame() }));
    rejectJoin(store);
    expect(result.current.a.joinError).toBeNull();
    expect(result.current.b.joinError).toBeNull();
  });

  it('ignores an old rejection after its list closes and reopens', () => {
    const old = setup(() => useJoinGame());
    const background = renderHook(() => useJoinGame(), { wrapper: old.Wrapper });
    act(() => old.result.current.beginJoin(2, makeGame(), false, false));
    const id = requestId(old.webClient);
    old.unmount();
    const reopened = renderHook(() => useJoinGame(), { wrapper: old.Wrapper });
    rejectJoin(old.store, id);
    expect(reopened.result.current.joinError).toBeNull();
    expect(background.result.current.joinError).toBeNull();
  });

  it('retains the latest accepted error when an older same-game request rejects later', () => {
    const { result, store, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame(), false, false));
    const oldId = requestId(webClient);
    act(() => result.current.beginJoin(2, makeGame(), false, false));
    const newId = requestId(webClient);
    rejectJoin(store, newId);
    const accepted = result.current.joinError;
    rejectJoin(store, newId);
    expect(result.current.joinError).toBe(accepted);
    rejectJoin(store, oldId);
    expect(result.current.joinError).toBe(accepted);
    expect(result.current.joinError?.requestId).toBe(newId);
    expect(newId).not.toBe(oldId);
  });

  it('keeps each list error when another list receives or dismisses its own error', () => {
    const { result, store, webClient } = setup(() => ({ a: useJoinGame(), b: useJoinGame() }));
    act(() => result.current.a.beginJoin(2, makeGame(), false, false));
    const aId = requestId(webClient);
    act(() => result.current.b.beginJoin(2, makeGame(), false, false));
    const bId = requestId(webClient);
    rejectJoin(store, aId);
    expect(result.current.a.joinError?.requestId).toBe(aId);
    expect(result.current.b.joinError).toBeNull();
    rejectJoin(store, bId);
    const bError = result.current.b.joinError;
    act(() => result.current.a.clearJoinError());
    expect(result.current.a.joinError).toBeNull();
    expect(result.current.b.joinError).toBe(bError);
    expect(store.getState().rooms.joinGameError?.requestId).toBe(bId);
  });

  it('ignores duplicate failures after dismissal and cancels ownership at session end', () => {
    const { result, store, webClient } = setup(() => useJoinGame());
    act(() => result.current.beginJoin(2, makeGame(), false, false));
    const first = requestId(webClient);
    rejectJoin(store, first);
    act(() => result.current.clearJoinError());
    rejectJoin(store, first);
    expect(result.current.joinError).toBeNull();
    act(() => result.current.beginJoin(2, makeGame(), false, false));
    const next = requestId(webClient);
    act(() => endSession());
    rejectJoin(store, next);
    expect(result.current.joinError).toBeNull();
  });
});

describe('useNavigateOnGameJoined', () => {
  it('routes once to the joined game however many lists are listening', () => {
    const onJoined = vi.fn();
    const { store, location } = setup(() => {
      useNavigateOnGameJoined(onJoined);
      useNavigateOnGameJoined();
    });
    act(() => {
      store.dispatch(games.Actions.gameJoined({
        data: create(Event_GameJoinedSchema, { gameInfo: create(ServerInfo_GameSchema, { gameId: 9 }) }),
      }) as never);
    });
    expect(location.pathname).toBe('/game/9');
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/game/9');
    expect(onJoined).toHaveBeenCalledWith(9);
  });
});

const { IsRegistered, IsModerator, IsJudge } = ServerInfo_User_UserLevelFlag;
describe.each([
  ['ordinary', IsRegistered, false, false],
  ['locked ordinary', IsRegistered, true, false],
  ['moderator', IsModerator, false, true],
  ['locked moderator', IsModerator, true, false],
  ['judge', IsJudge, false, true],
  ['locked judge', IsJudge, true, true],
] as const)('restriction override: %s', (_name, userLevel, locked, override) => {
  it.each([false, true])('uses the same privilege for password prompting and the wire (password: %s)', (withPassword) => {
    setAdminLocked(locked);
    const state = {
      ...connectedState,
      server: { ...connectedState.server!, user: makeUser({ userLevel }) },
    };
    const { result, webClient } = setup(() => useJoinGame(), state);
    act(() => result.current.beginJoin(2, makeGame({ withPassword }), false, false));
    expect(result.current.passwordRequired).toBe(withPassword && !override);
    if (withPassword && !override) {
      expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
      act(() => result.current.submitPassword('secret'));
    }
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({
      overrideRestrictions: override,
      password: withPassword && !override ? 'secret' : '',
    }), expect.any(String));
  });
});
