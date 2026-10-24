import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';
import { createStore, rooms } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { ServerInfo_GameSchema, ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';

import { rootReducerMap, type RootState } from '../../store';
import { connectedWithRoomsState, createMockWebClient } from '../../__test-utils__';
import { ROOM_JOIN_WAIT_MS, useJoinFriendGame } from './useJoinFriendGame';

const reducer = combineReducers(rootReducerMap);

function setup() {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({ reducer: reducer as never, preloadedState: connectedWithRoomsState });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </WebClientContext>
      </Provider>
    );
  }
  const view = renderHook(() => useJoinFriendGame(), { wrapper: Wrapper });
  return { ...view, store, webClient };
}

const game = (roomId: number, overrides = {}) =>
  create(ServerInfo_GameSchema, { gameId: 7, roomId, playerCount: 1, maxPlayers: 2, spectatorsAllowed: true, ...overrides });

describe('useJoinFriendGame', () => {
  afterEach(() => vi.useRealTimers());

  it('joins straight away in a room you are already in', () => {
    const { result, webClient } = setup();
    act(() => result.current.join(game(1)));
    expect(webClient.request.session.joinRoom).not.toHaveBeenCalled();
    expect(webClient.request.rooms.joinGame)
      .toHaveBeenCalledWith(1, expect.objectContaining({ gameId: 7, spectator: false }), expect.any(String));
  });

  it('spectates when asked to watch', () => {
    const { result, webClient } = setup();
    act(() => result.current.watch(game(1, { started: true, playerCount: 2 })));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({ spectator: true }), expect.any(String));
  });

  it('joins the game\'s room first, then the game once the room is joined', () => {
    const { result, webClient, store } = setup();
    act(() => result.current.join(game(2)));
    expect(webClient.request.session.joinRoom).toHaveBeenCalledWith(2);
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    expect(result.current.waitingForRoom).toBe(true);
    act(() => {
      store.dispatch(rooms.Actions.joinRoom({ roomInfo: create(ServerInfo_RoomSchema, { roomId: 2, name: 'Side' }) }));
    });
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(2, expect.objectContaining({ gameId: 7 }), expect.any(String));
    expect(result.current.waitingForRoom).toBe(false);
  });

  it('gives up and reports it when the room never opens', () => {
    vi.useFakeTimers();
    const { result, webClient } = setup();
    act(() => result.current.join(game(2)));
    act(() => vi.advanceTimersByTime(ROOM_JOIN_WAIT_MS));
    expect(result.current.roomTimedOut).toBe(true);
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    act(() => result.current.dismissRoomTimeout());
    expect(result.current.roomTimedOut).toBe(false);
  });
});
