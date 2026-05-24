import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { createStore } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';

import { rootReducerMap, type RootState } from '../../store';
import { ToastProvider } from '../../components/Toast/ToastContext';
import { createMockWebClient, connectedState } from '../../__test-utils__';
import { useLogs } from './useLogs';

const reducer = combineReducers(rootReducerMap);

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en-US',
  resources: { 'en-US': { translation: {} } },
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

function setup(preloadedState: Partial<RootState> = connectedState) {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({ reducer: reducer as any, preloadedState });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <I18nextProvider i18n={testI18n}>
            <ToastProvider>{children}</ToastProvider>
          </I18nextProvider>
        </WebClientContext>
      </Provider>
    );
  }
  const view = renderHook(() => useLogs(), { wrapper: Wrapper });
  return { ...view, webClient, store };
}

describe('useLogs', () => {
  it('exposes the logs slice from server state', () => {
    const { result } = setup();
    expect(result.current.logs).toEqual({ room: [], game: [], chat: [] });
  });

  it('dispatches viewLogHistory when at least one required field is provided', () => {
    const { result, webClient } = setup();
    result.current.onSubmit({ userName: 'alice', logLocation: { room: true } });

    expect(webClient.request.moderator.viewLogHistory).toHaveBeenCalledTimes(1);
    const params = (webClient.request.moderator.viewLogHistory as any).mock.calls[0][0];
    expect(params.userName).toBe('alice');
    expect(params.logLocation).toEqual(['room']);
    expect(params.maximumResults).toBe(1000);
  });

  it('trims whitespace-only fields out of the wire params', () => {
    const { result, webClient } = setup();
    result.current.onSubmit({ userName: '  bob  ', ipAddress: '   ', message: 'hello' });

    const params = (webClient.request.moderator.viewLogHistory as any).mock.calls[0][0];
    expect(params.userName).toBe('bob');
    expect(params.ipAddress).toBeUndefined();
    expect(params.message).toBe('hello');
  });

  it('flattens all selected log locations', () => {
    const { result, webClient } = setup();
    result.current.onSubmit({
      gameId: '7',
      logLocation: { room: true, game: true, chat: false },
    });
    const params = (webClient.request.moderator.viewLogHistory as any).mock.calls[0][0];
    expect(params.logLocation).toEqual(['room', 'game']);
  });

  it('does not dispatch viewLogHistory when no required filter is set', () => {
    const { result, webClient } = setup();
    act(() => {
      result.current.onSubmit({ logLocation: { room: true } });
    });
    expect(webClient.request.moderator.viewLogHistory).not.toHaveBeenCalled();
  });

  it('clears the logs slice on unmount', () => {
    // Assert the effect's observable result rather than spying on dispatch:
    // useAppDispatch() captures the store's original dispatch at render time,
    // so a post-render vi.spyOn would never see the cleanup call.
    const stateWithLogs = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        logs: { room: [{ message: 'entry' }], game: [], chat: [] },
      },
    };
    const { unmount, store } = setup(stateWithLogs as Partial<RootState>);
    expect(store.getState().server.logs.room).toHaveLength(1);

    unmount();

    expect(store.getState().server.logs.room).toHaveLength(0);
  });
});
