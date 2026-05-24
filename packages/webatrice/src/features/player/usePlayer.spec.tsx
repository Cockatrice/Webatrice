import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createStore } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';

import { rootReducerMap, type RootState } from '../../store';
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
  return { result, webClient };
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

  it('onSendMessage / onWarnUser / onBanFromServer forward to the web client', () => {
    const { result, webClient } = setup(stateWithPlayer('alice'), 'alice');
    result.current.onSendMessage('hi');
    expect(webClient.request.session.message).toHaveBeenCalledWith('alice', 'hi');
    result.current.onWarnUser('bad');
    expect(webClient.request.moderator.warnUser).toHaveBeenCalledWith('alice', 'bad');
    result.current.onBanFromServer(60, 'reason', 'visible');
    expect(webClient.request.moderator.banFromServer).toHaveBeenCalledWith(
      60,
      'alice',
      undefined,
      'reason',
      'visible',
    );
  });

  it('handlers no-op when there is no player name', () => {
    const { result, webClient } = setup(connectedState, undefined);
    result.current.onAddBuddy();
    result.current.onSendMessage('x');
    expect(webClient.request.session.addToBuddyList).not.toHaveBeenCalled();
    expect(webClient.request.session.message).not.toHaveBeenCalled();
  });
});
