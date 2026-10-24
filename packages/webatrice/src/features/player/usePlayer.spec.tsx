import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createStore } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';

import { rootReducerMap, type RootState } from '../../store';
import { getSettings, settingsStore } from '../../hooks/useSettings';
import { createMockWebClient, connectedState, makeUser } from '../../__test-utils__';
import { usePlayer } from './usePlayer';

const reducer = combineReducers(rootReducerMap);

function setup(preloadedState: Partial<RootState>, name: string | undefined) {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({
    reducer: reducer as any,
    preloadedState,
  });
  const route = name === undefined ? '/player' : `/player/${name}`;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/player" element={children} />
              <Route path="/player/:name" element={children} />
            </Routes>
          </MemoryRouter>
        </WebClientContext>
      </Provider>
    );
  }
  const { result } = renderHook(() => usePlayer(), { wrapper: Wrapper });
  return { result, webClient, store };
}

const stateWithPlayer = (name: string, overrides = {}) => ({
  ...connectedState,
  server: {
    ...(connectedState.server as any),
    userInfo: { [name]: makeUser({ name }) },
    buddyList: {},
    ignoreList: {},
    ...overrides,
  },
});

describe('usePlayer', () => {
  it('reads the player name from the route param and requests user info', async () => {
    const { result, webClient } = setup(stateWithPlayer('alice'), 'alice');
    expect(result.current.name).toBe('alice');
    expect(result.current.userInfo?.name).toBe('alice');
    await waitFor(() => {
      expect(webClient.request.session.getUserInfo).toHaveBeenCalledWith('alice');
    });
  });

  it('returns a null name and skips the user info request when no param', () => {
    const { result, webClient } = setup(connectedState, undefined);
    expect(result.current.name).toBeNull();
    expect(result.current.userInfo).toBeUndefined();
    expect(webClient.request.session.getUserInfo).not.toHaveBeenCalled();
  });

  it('opens the conversation while the page shows another player, so presence notices land in it', () => {
    const { store } = setup(stateWithPlayer('alice'), 'alice');
    expect(store.getState().server.messages.alice).toEqual([]);
  });

  it('opens no conversation with yourself', () => {
    const { store } = setup(stateWithPlayer('testUser'), 'testUser');
    expect(store.getState().server.messages.testUser).toBeUndefined();
  });

  it('marks the current user as self', () => {
    const { result } = setup(stateWithPlayer('testUser'), 'testUser');
    expect(result.current.isSelf).toBe(true);
  });

  it('detects buddy and ignore membership', () => {
    const { result } = setup(
      stateWithPlayer('alice', { buddyList: { alice: makeUser({ name: 'alice' }) } }),
      'alice',
    );
    expect(result.current.isABuddy).toBe(true);
    expect(result.current.isIgnored).toBe(false);
  });

  it('exposes the conversation with its notices and the player presence', () => {
    const { result } = setup(
      stateWithPlayer('alice', {
        users: { alice: makeUser({ name: 'alice' }) },
        privateChatNotices: { alice: [{ id: 1, kind: 'userJoined', position: 0 }] },
      }),
      'alice',
    );
    expect(result.current.isOnline).toBe(true);
    expect(result.current.conversation).toEqual([
      { type: 'notice', notice: { id: 1, kind: 'userJoined', position: 0 } },
    ]);
  });

  it('reports a player missing from the online list as offline', () => {
    const { result } = setup(stateWithPlayer('alice'), 'alice');
    expect(result.current.isOnline).toBe(false);
    expect(result.current.conversation).toEqual([]);
  });

  it('onAddBuddy / onRemoveBuddy hit the web client with the player name', () => {
    const { result, webClient } = setup(stateWithPlayer('alice'), 'alice');
    result.current.onAddBuddy();
    expect(webClient.request.session.addToBuddyList).toHaveBeenCalledWith('alice');
    result.current.onRemoveBuddy();
    expect(webClient.request.session.removeFromBuddyList).toHaveBeenCalledWith('alice');
  });

  it('onAddIgnore / onRemoveIgnore hit the web client with the player name', () => {
    const { result, webClient } = setup(stateWithPlayer('alice'), 'alice');
    result.current.onAddIgnore();
    expect(webClient.request.session.addToIgnoreList).toHaveBeenCalledWith('alice');
    result.current.onRemoveIgnore();
    expect(webClient.request.session.removeFromIgnoreList).toHaveBeenCalledWith('alice');
  });

  it('onSendMessage forwards to the web client', () => {
    const { result, webClient } = setup(stateWithPlayer('alice'), 'alice');
    result.current.onSendMessage('hi');
    expect(webClient.request.session.message).toHaveBeenCalledWith('alice', 'hi');
  });

  it('handlers no-op when there is no player name', () => {
    const { result, webClient } = setup(connectedState, undefined);
    result.current.onAddBuddy();
    result.current.onSendMessage('x');
    expect(webClient.request.session.addToBuddyList).not.toHaveBeenCalled();
    expect(webClient.request.session.message).not.toHaveBeenCalled();
  });

  describe('private messages', () => {
    const conversation = () => [
      { senderName: 'alice', receiverName: 'TestUser', message: 'hi' },
      { senderName: 'TestUser', receiverName: 'alice', message: 'hello' },
      { senderName: 'alice', receiverName: 'TestUser', message: 'how are you' },
    ];
    const withConversation = (overrides = {}) => stateWithPlayer('alice', {
      user: makeUser({ name: 'TestUser' }),
      users: { alice: makeUser({ name: 'alice', userLevel: 3 }) },
      messages: { alice: conversation() },
      ...overrides,
    });
    const texts = (entries: { type: string; message?: { message: string }; notice?: { kind: string } }[]) =>
      entries.map((entry) => (entry.type === 'message' ? entry.message!.message : `notice:${entry.notice!.kind}`));

    beforeEach(async () => {
      settingsStore.reset();
      await getSettings();
    });

    it('returns the whole conversation by default', () => {
      const { result } = setup(withConversation(), 'alice');
      expect(texts(result.current.conversation)).toEqual(['hi', 'hello', 'how are you']);
    });

    it('applies the Chat preferences, e.g. ignoring non-buddies until you write to them', async () => {
      const settings = await getSettings();
      settings.ignoreNonBuddyUserMessages = true;
      settingsStore.setValue(settings);

      const { result } = setup(withConversation({
        privateChatNotices: { alice: [{ id: 1, kind: 'userLeft', position: 1 }] },
      }), 'alice');
      expect(texts(result.current.conversation)).toEqual(['notice:userLeft', 'hello', 'how are you']);
    });
  });
});
