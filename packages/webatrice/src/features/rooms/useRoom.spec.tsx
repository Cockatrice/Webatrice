import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createStore } from '@cockatrice/datatrice';
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
  const { result } = renderHook(() => useRoom(), { wrapper: Wrapper });
  return { result, webClient };
}

describe('useRoom', () => {
  it('resolves the room, messages and users for a joined room', () => {
    const { result } = setup(connectedWithRoomsState, '1');

    expect(result.current.roomId).toBe(1);
    expect(result.current.room?.info.name).toBe('Main Room');
    expect(result.current.roomMessages).toEqual([]);
    expect(Array.isArray(result.current.users)).toBe(true);
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
});
