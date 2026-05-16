import { createRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import {
  GameMessage,
  games,
  type GamesState,
} from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeUser,
} from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import { formatElapsed, useGameLog } from './useGameLog';

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
  return { games: { 1: game } };
}

interface SetupOpts {
  state?: GamesState;
  gameId?: number | undefined;
}

function setupWithGame(opts: SetupOpts = {}) {
  const state: GamesState = opts.state ?? stateWith();
  const gameId: number | undefined = 'gameId' in opts ? opts.gameId : 1;
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: state },
  });
  const listRef = createRef<HTMLDivElement>();
  const list = document.createElement('div');
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 });
  list.scrollTop = 0;
  (listRef as { current: HTMLDivElement | null }).current = list;

  const { result } = renderHook(() => useGameLog({ gameId, listRef }), { wrapper: Wrapper });
  return { result, webClient, listRef, list };
}

describe('useGameLog', () => {
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
});
