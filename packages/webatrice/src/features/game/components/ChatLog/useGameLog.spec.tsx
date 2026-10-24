import { createRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import {
  GameMessage,
  games,
  server,
  type GamesState,
} from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import {
  makeGameEntry,
  makeGameInfo,
  makePlayerEntry,
  makePlayerProperties,
  makeUser,
} from '@cockatrice/datatrice/testing';

import { setAdminLocked } from '@app/hooks';
import { connectedState } from '../../../../__test-utils__';
import { makeReduxWebClientHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { formatElapsed, useGameLog } from './useGameLog';
import { GameReadOnlyProvider } from '../ui/GameReadOnlyContext';

function stateWith({
  messages = [] as GameMessage[],
  secondsElapsed = 0,
}: { messages?: GameMessage[]; secondsElapsed?: number } = {}): GamesState {
  const player = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 1, userInfo: makeUser({ name: 'Alice' }) }),
  });
  const game = makeGameEntry({
    localPlayerId: 1,
    players: { 1: player },
    messages,
    secondsElapsed,
  });
  return { games: { 1: game }, pings: {} };
}

interface SetupOpts {
  state?: GamesState;
  gameId?: number | undefined;
  userLevel?: number;
  readOnly?: boolean;
}

function setupWithGame(opts: SetupOpts = {}) {
  const state: GamesState = opts.state ?? stateWith();
  const gameId: number | undefined = 'gameId' in opts ? opts.gameId : 1;
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer, server: server.serverReducer }),
    preloadedState: {
      games: state,
      server: { ...(connectedState.server as any), user: makeUser({ name: 'Alice', userLevel: opts.userLevel ?? 0 }) },
    },
  });
  const listRef = createRef<HTMLDivElement>();
  const list = document.createElement('div');
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 });
  list.scrollTop = 0;
  (listRef as { current: HTMLDivElement | null }).current = list;

  const { result } = renderHook(() => useGameLog({ gameId, listRef }), {
    wrapper: ({ children }) => <Wrapper><GameReadOnlyProvider value={opts.readOnly ?? false}>{children}</GameReadOnlyProvider></Wrapper>,
  });
  return { result, webClient, listRef, list };
}

describe('useGameLog', () => {
  it('re-pins the log to the bottom when it becomes visible again', () => {
    const { Wrapper } = makeReduxWebClientHookWrapper({
      reducer: combineReducers({ games: games.gamesReducer, server: server.serverReducer }),
      preloadedState: {
        games: stateWith(),
        server: { ...(connectedState.server as any), user: makeUser({ name: 'Alice' }) },
      },
    });
    const list = document.createElement('div');
    let scrollHeight = 0;
    Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 });
    const listRef = { current: list };
    const { rerender } = renderHook(({ visible }) => useGameLog({ gameId: 1, listRef, visible }), {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
      initialProps: { visible: false },
    });
    expect(list.scrollTop).toBe(0);
    scrollHeight = 1000;
    rerender({ visible: true });
    expect(list.scrollTop).toBe(1000);
  });

  it.each([false, true])('ticks only for a live game (readOnly=%s)', (readOnly) => {
    vi.useFakeTimers();
    try {
      const { result } = setupWithGame({ state: stateWith({ secondsElapsed: 42 }), readOnly });
      act(() => vi.advanceTimersByTime(3000));
      expect(result.current.displaySeconds).toBe(readOnly ? 42 : 45);
    } finally {
      vi.useRealTimers();
    }
  });

  it('formatElapsed renders seconds in HH:MM:SS form', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(3723)).toBe('01:02:03');
  });

  it('exposes messages and players slices and seeds displaySeconds from secondsElapsed', () => {
    const messages: GameMessage[] = [{ playerId: 1, message: 'gl hf', timeReceived: 0 }];
    const { result } = setupWithGame({ state: stateWith({ messages, secondsElapsed: 42 }) });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.players?.[1]).toBeDefined();
    expect(result.current.displaySeconds).toBe(42);
  });

  it('handleSubmit trims the draft, dispatches gameSay, and clears the draft', () => {
    const { result, webClient } = setupWithGame();

    act(() => {
      result.current.setDraft('  hello world  ');
    });
    expect(result.current.draft).toBe('  hello world  ');

    const event = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>;
    act(() => {
      result.current.handleSubmit(event);
    });

    expect(webClient.request.game.gameSay).toHaveBeenCalledWith(1, { message: 'hello world' });
    expect(result.current.draft).toBe('');
  });

  it('handleSubmit does nothing for whitespace-only drafts', () => {
    const { result, webClient } = setupWithGame();

    act(() => {
      result.current.setDraft('   ');
    });
    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
    act(() => {
      result.current.handleSubmit(event);
    });

    expect(webClient.request.game.gameSay).not.toHaveBeenCalled();
  });

  it('is inert (no dispatch, empty messages) when gameId is undefined', () => {
    const { result, webClient } = setupWithGame({ gameId: undefined });

    act(() => {
      result.current.setDraft('hello');
    });
    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
    act(() => {
      result.current.handleSubmit(event);
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.players).toBeUndefined();
    expect(webClient.request.game.gameSay).not.toHaveBeenCalled();
  });

  describe('spectator chat (desktop tab_game.cpp, Servatrice cmdGameSay)', () => {
    const { IsRegistered, IsModerator } = ServerInfo_User_UserLevelFlag;

    function spectating({ judge = false } = {}): GamesState {
      const game = makeGameEntry({ spectator: true, judge, info: makeGameInfo({ spectatorsCanChat: false }) });
      return { games: { 1: game }, pings: {} };
    }

    afterEach(() => {
      setAdminLocked(false);
    });

    it('stops a spectator from chatting when the game forbids it', () => {
      const { result } = setupWithGame({ state: spectating(), userLevel: IsRegistered });
      expect(result.current.canChat).toBe(false);
      expect(result.current.chatDisabledReason).toBe('ChatLog.spectatorChatDisabled');
    });

    it('lets a moderator chat as a spectator while the admin lock is off', () => {
      const { result } = setupWithGame({ state: spectating(), userLevel: IsRegistered | IsModerator });
      expect(result.current.canChat).toBe(true);
    });

    it('treats a locked moderator as a plain spectator', () => {
      setAdminLocked(true);
      const { result } = setupWithGame({ state: spectating(), userLevel: IsRegistered | IsModerator });
      expect(result.current.canChat).toBe(false);
    });

    it('lets the game judge chat as a spectator', () => {
      const { result } = setupWithGame({ state: spectating({ judge: true }), userLevel: IsRegistered });
      expect(result.current.canChat).toBe(true);
    });
  });
});
