import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { rootReducerMap, type RootState } from '../../store';
import { connectedState, createMockWebClient } from '../../__test-utils__';
import { makeReduxWebClientHookWrapper } from '../../__test-utils__/makeHookWrapper';
import { useUserDisplay } from './useUserDisplay';

const reducer = combineReducers(rootReducerMap);

function setup(preloadedState: Partial<RootState>, userName: string) {
  const webClient = createMockWebClient();
  const { Wrapper } = makeReduxWebClientHookWrapper({
    reducer: reducer as never,
    preloadedState: preloadedState as never,
    webClient,
  });
  const { result } = renderHook(() => useUserDisplay(userName), { wrapper: Wrapper });
  return { result, webClient };
}

describe('useUserDisplay', () => {
  it('starts with the menu closed and buddy/ignore flags false', () => {
    const { result } = setup(connectedState, 'someUser');

    expect(result.current.menu.anchor).toBeNull();
    expect(result.current.isABuddy).toBe(false);
    expect(result.current.isIgnored).toBe(false);
  });

  it('opens the menu at a right-click and closes it again', () => {
    const { result } = setup(connectedState, 'someUser');

    act(() => {
      result.current.menu.getTriggerProps().onContextMenu({
        clientX: 100,
        clientY: 200,
        currentTarget: document.createElement('a'),
        preventDefault: vi.fn(),
      } as never);
    });
    expect(result.current.menu.anchor).toEqual({ x: 100, y: 200 });

    act(() => {
      result.current.menu.close();
    });
    expect(result.current.menu.anchor).toBeNull();
  });

  it('reflects buddy and ignore membership from server state', () => {
    const state = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        buddyList: { friend: { name: 'friend' } as any },
        ignoreList: { spammer: { name: 'spammer' } as any },
      },
    };
    const buddy = setup(state, 'friend');
    const ignored = setup(state, 'spammer');

    expect(buddy.result.current.isABuddy).toBe(true);
    expect(ignored.result.current.isIgnored).toBe(true);
  });

  it('onAddBuddy / onAddIgnore dispatch through the web client and close the menu', () => {
    const { result, webClient } = setup(connectedState, 'target');

    act(() => {
      result.current.menu.getTriggerProps().onContextMenu({
        clientX: 5,
        clientY: 5,
        currentTarget: document.createElement('a'),
        preventDefault: vi.fn(),
      } as never);
    });
    expect(result.current.menu.anchor).not.toBeNull();

    act(() => {
      result.current.onAddBuddy();
    });
    expect(webClient.request.session.addToBuddyList).toHaveBeenCalledWith('target');
    expect(result.current.menu.anchor).toBeNull();

    act(() => {
      result.current.onAddIgnore();
    });
    expect(webClient.request.session.addToIgnoreList).toHaveBeenCalledWith('target');
  });

  it('onRemoveBuddy and onRemoveIgnore dispatch the matching commands', () => {
    const { result, webClient } = setup(connectedState, 'target');

    act(() => {
      result.current.onRemoveBuddy();
    });
    expect(webClient.request.session.removeFromBuddyList).toHaveBeenCalledWith('target');

    act(() => {
      result.current.onRemoveIgnore();
    });
    expect(webClient.request.session.removeFromIgnoreList).toHaveBeenCalledWith('target');
  });
});
