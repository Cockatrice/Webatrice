import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createStore, rooms } from '@cockatrice/datatrice';
import { Event_RoomSaySchema, ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';
import { WebClientContext } from '@cockatrice/datatrice/react';

import { rootReducerMap, type RootState } from '../../store';
import { createMockWebClient, connectedWithRoomsState } from '../../__test-utils__';
import { useRoom } from './useRoom';

const reducer = combineReducers(rootReducerMap);

function setup(preloadedState: Partial<RootState>, roomIdParam: string) {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({ reducer: reducer as never, preloadedState });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <MemoryRouter initialEntries={[`/room/${roomIdParam}`]}>
            <Routes>
              <Route path="/room/:roomId" element={children} />
              <Route path="/server" element={children} />
            </Routes>
          </MemoryRouter>
        </WebClientContext>
      </Provider>
    );
  }
  const rendered = vi.fn();
  const { result } = renderHook(() => {
    rendered();
    return useRoom();
  }, { wrapper: Wrapper });
  return { result, webClient, store, rendered };
}

describe('useRoom', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves the room and messages for a joined room', () => {
    const { result } = setup(connectedWithRoomsState, '1');

    expect(result.current.roomId).toBe(1);
    expect(result.current.room?.info.name).toBe('Main Room');
    expect(result.current.roomMessages).toEqual([]);
  });

  it('ignores other-room messages and membership changes but updates for the selected room', () => {
    const { result, store, rendered } = setup(connectedWithRoomsState, '1');
    const before = rendered.mock.calls.length;
    act(() => store.dispatch(rooms.Actions.joinRoom({ roomInfo: create(ServerInfo_RoomSchema, { roomId: 2 }) })));
    expect(rendered).toHaveBeenCalledTimes(before);
    const message = { ...create(Event_RoomSaySchema, { name: 'otherUser', message: 'hello' }), timeReceived: 0 };
    act(() => store.dispatch(rooms.Actions.addMessage({ roomId: 2, message })));
    expect(rendered).toHaveBeenCalledTimes(before);
    act(() => store.dispatch(rooms.Actions.leaveRoom({ roomId: 2 })));
    expect(rendered).toHaveBeenCalledTimes(before);
    act(() => store.dispatch(rooms.Actions.addMessage({ roomId: 1, message })));
    expect(result.current.roomMessages?.at(-1)?.message).toBe('otherUser: hello');
    expect(rendered).toHaveBeenCalledTimes(before + 1);
    act(() => store.dispatch(rooms.Actions.joinRoom({ roomInfo: create(ServerInfo_RoomSchema, { roomId: 1, name: 'Renamed' }) })));
    expect(result.current.room?.info.name).toBe('Renamed');
    act(() => store.dispatch(rooms.Actions.leaveRoom({ roomId: 1 })));
    expect(result.current.roomId).toBe(-1);
    expect(result.current.room).toBeUndefined();
  });

  it('does not sort users for the unused users field', () => {
    const sorted = vi.spyOn(rooms.Selectors, 'getSortedRoomUsers');
    const { result } = setup(connectedWithRoomsState, '1');
    expect(sorted).not.toHaveBeenCalled();
    expect(result.current).not.toHaveProperty('users');
  });

  it.each(['2', '999'])('redirects an unjoined or missing room (%s)', (roomId) => {
    const state = connectedWithRoomsState.rooms!;
    const { result } = setup({
      ...connectedWithRoomsState,
      rooms: { ...state, rooms: { ...state.rooms, 2: { ...state.rooms[1], info: create(ServerInfo_RoomSchema, { roomId: 2 }) } } },
    }, roomId);
    expect(result.current.roomId).toBe(-1);
  });

  it('falls back to roomId -1 and an undefined room for a non-numeric param', () => {
    const { result } = setup(connectedWithRoomsState, 'not-a-number');

    expect(result.current.roomId).toBe(-1);
    expect(result.current.room).toBeUndefined();
    expect(result.current.roomMessages).toBeUndefined();
  });

  it('handleRoomSay forwards the message to the web client', () => {
    const { result, webClient } = setup(connectedWithRoomsState, '1');

    result.current.handleRoomSay({ message: 'hello' });

    expect(webClient.request.rooms.roomSay).toHaveBeenCalledWith(1, 'hello');
  });

  it('handleRoomSay ignores an empty message', () => {
    const { result, webClient } = setup(connectedWithRoomsState, '1');

    result.current.handleRoomSay({ message: '' });

    expect(webClient.request.rooms.roomSay).not.toHaveBeenCalled();
  });

  it('handleCreateGame creates the game in this room', () => {
    const { result, webClient } = setup(connectedWithRoomsState, '1');
    const params = { description: 'pod' } as never;

    result.current.handleCreateGame(params);

    expect(webClient.request.rooms.createGame).toHaveBeenCalledWith(1, params);
  });
});
