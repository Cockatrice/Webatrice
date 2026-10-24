import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { create } from '@bufbuild/protobuf';
import { createStore, server } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { Response_GetGamesOfUserSchema, ServerInfo_GameSchema, ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';

import { rootReducerMap, type RootState } from '../../store';
import { connectedState, createMockWebClient } from '../../__test-utils__';
import { PRESENCE_POLL_MS } from './presencePolling';
import { useBuddyPresence } from './useBuddyPresence';

const reducer = combineReducers(rootReducerMap);

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function setup(initial: string[]) {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({ reducer: reducer as never, preloadedState: connectedState });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>{children}</WebClientContext>
      </Provider>
    );
  }
  const view = renderHook(({ names }) => useBuddyPresence(names), { wrapper: Wrapper, initialProps: { names: initial } });
  const fetched = () => vi.mocked(webClient.request.session.getGamesOfUser).mock.calls.map(([name]) => name);
  return { ...view, store, webClient, fetched };
}

describe('useBuddyPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it(`asks once per online buddy on open, then again every ${PRESENCE_POLL_MS / 1000}s`, () => {
    const { fetched } = setup(['kira', 'mei']);
    expect(fetched()).toEqual(['kira', 'mei']);
    act(() => vi.advanceTimersByTime(PRESENCE_POLL_MS - 1));
    expect(fetched()).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(fetched()).toEqual(['kira', 'mei', 'kira', 'mei']);
  });

  it('asks about a buddy who comes online right away, without asking the others again', () => {
    const { fetched, rerender } = setup(['kira']);
    rerender({ names: ['kira', 'tomo'] });
    expect(fetched()).toEqual(['kira', 'tomo']);
  });

  it('stops while the page is hidden and catches up when it is shown again', () => {
    const { fetched } = setup(['kira']);
    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(PRESENCE_POLL_MS * 3));
    expect(fetched()).toEqual(['kira']);
    act(() => setVisibility('visible'));
    expect(fetched()).toEqual(['kira', 'kira']);
  });

  it('stops polling when unmounted', () => {
    const { fetched, unmount } = setup(['kira']);
    unmount();
    act(() => vi.advanceTimersByTime(PRESENCE_POLL_MS * 3));
    expect(fetched()).toEqual(['kira']);
  });

  it('reports what each buddy is doing and keeps it while a refresh is in flight', () => {
    const { result, store } = setup(['kira']);
    expect(result.current.kira).toEqual({ kind: 'unknown' });
    const response = create(Response_GetGamesOfUserSchema, {
      roomList: [create(ServerInfo_RoomSchema, { roomId: 1, name: 'General' })],
      gameList: [create(ServerInfo_GameSchema, { gameId: 3, roomId: 1, started: true, playerCount: 2, maxPlayers: 2 })],
    });
    act(() => {
      store.dispatch(server.Actions.gamesOfUser({ userName: 'kira', response }));
    });
    expect(result.current.kira).toMatchObject({ kind: 'playing', room: 'General' });
    act(() => {
      store.dispatch(server.Actions.gamesOfUserRequested({ userName: 'kira' }));
    });
    expect(result.current.kira).toMatchObject({ kind: 'playing', room: 'General' });
  });
});
