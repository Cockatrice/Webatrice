import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { rootReducerMap, type RootState } from '../../store';
import {
  makeReduxWebClientHookWrapper,
} from '../../__test-utils__/makeHookWrapper';
import { createMockWebClient, connectedState, disconnectedState, makeUser } from '../../__test-utils__';
import { useAccount } from './useAccount';

const reducer = combineReducers(rootReducerMap);

function setup(preloadedState: Partial<RootState>) {
  const webClient = createMockWebClient();
  const { Wrapper } = makeReduxWebClientHookWrapper({
    reducer: reducer as any,
    preloadedState: preloadedState as any,
    webClient,
  });
  const { result } = renderHook(() => useAccount(), { wrapper: Wrapper });
  return { result, webClient };
}

describe('useAccount', () => {
  it('exposes server name/version and the current user from state', () => {
    const { result } = setup(connectedState);
    expect(result.current.serverName).toBe('Test Server');
    expect(result.current.serverVersion).toBe('1.0.0');
    expect(result.current.user?.name).toBe('testUser');
    expect(result.current.buddyList).toEqual([]);
    expect(result.current.ignoreList).toEqual([]);
  });

  it('returns an empty avatar url when the user has no avatar bitmap', () => {
    const state = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        user: makeUser({ avatarBmp: undefined as any }),
      },
    };
    const { result } = setup(state);
    expect(result.current.avatarUrl).toBe('');
  });

  it('builds an object url when the user has an avatar bitmap', () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    (globalThis.URL as any).createObjectURL = createObjectURL;
    (globalThis.URL as any).revokeObjectURL = revokeObjectURL;

    const state = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        user: makeUser({ avatarBmp: new Uint8Array([1, 2, 3]) }),
      },
    };
    const { result } = setup(state);
    expect(createObjectURL).toHaveBeenCalled();
    expect(result.current.avatarUrl).toBe('blob:fake-url');
  });

  it('handleAddToBuddies dispatches addToBuddyList through the web client', () => {
    const { result, webClient } = setup(connectedState);
    result.current.handleAddToBuddies({ userName: 'newBuddy' });
    expect(webClient.request.session.addToBuddyList).toHaveBeenCalledWith('newBuddy');
  });

  it('handleAddToIgnore dispatches addToIgnoreList through the web client', () => {
    const { result, webClient } = setup(connectedState);
    result.current.handleAddToIgnore({ userName: 'spammer' });
    expect(webClient.request.session.addToIgnoreList).toHaveBeenCalledWith('spammer');
  });

  it('handleDisconnect dispatches disconnect through the web client', () => {
    const { result, webClient } = setup(connectedState);
    result.current.handleDisconnect();
    expect(webClient.request.authentication.disconnect).toHaveBeenCalled();
  });

  it('returns a null user when disconnected', () => {
    const { result } = setup(disconnectedState);
    expect(result.current.user).toBeNull();
  });
});
