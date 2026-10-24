import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { createStore, server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { WebClientContext } from '@cockatrice/datatrice/react';

import { create } from '@bufbuild/protobuf';
import { ServerInfo_ChatMessageSchema } from '@cockatrice/sockatrice/generated';
import { SessionScope } from '../../SessionScope';

import { rootReducerMap, type RootState } from '../../store';
import { ToastProvider } from '../../components/Toast/ToastContext';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';
import { createMockWebClient, connected31State, makeUser } from '../../__test-utils__';
import { LOG_SEARCH_DEFAULTS, type LogSearchFormValues } from './LogSearchForm/logSearchFormSchema';
import { toViewLogHistoryParams, useLogs } from './useLogs';

const reducer = combineReducers(rootReducerMap);

function withLevel(userLevel: number): Partial<RootState> {
  return { ...connected31State, server: { ...(connected31State.server as any), user: makeUser({ userLevel }) } };
}

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en-US',
  resources: { 'en-US': { translation: {} } },
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

function setup(preloadedState: Partial<RootState> = withLevel(Level.IsUser | Level.IsRegistered | Level.IsModerator)) {
  const webClient = createMockWebClient();
  const store = createStore<RootState>({ reducer: reducer as any, preloadedState });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <I18nextProvider i18n={testI18n}>
            <ToastProvider><SessionScope>{children}</SessionScope></ToastProvider>
          </I18nextProvider>
        </WebClientContext>
      </Provider>
    );
  }
  const view = renderHook(() => useLogs(), { wrapper: Wrapper });
  return { ...view, webClient, store };
}


const search = (overrides: Partial<LogSearchFormValues>): LogSearchFormValues => ({
  ...LOG_SEARCH_DEFAULTS,
  logLocation: { room: true, game: true, chat: true },
  dateRange: 'pastDays',
  pastDays: 20,
  maximumResults: 1000,
  ...overrides,
});

describe('toViewLogHistoryParams', () => {
  it('sends the look-back in hours, as desktop does', () => {
    expect(toViewLogHistoryParams(search({ dateRange: 'lastHour' })).dateRange).toBe(1);
    expect(toViewLogHistoryParams(search({ dateRange: 'today' })).dateRange).toBe(24);
    expect(toViewLogHistoryParams(search({ dateRange: 'pastDays', pastDays: 3 })).dateRange).toBe(72);
  });

  it('passes the chosen maximum and the selected locations', () => {
    const params = toViewLogHistoryParams(search({ maximumResults: 50, logLocation: { room: true, game: false, chat: true } }));
    expect(params.maximumResults).toBe(50);
    expect(params.logLocation).toEqual(['room', 'chat']);
  });

  it('trims text filters and leaves blank ones out', () => {
    const params = toViewLogHistoryParams(search({ userName: '  bob  ', ipAddress: '   ', message: 'hello' }));
    expect(params.userName).toBe('bob');
    expect(params.ipAddress).toBeUndefined();
    expect(params.message).toBe('hello');
  });
});

describe('useLogs', () => {
  it('exposes the logs slice from server state', () => {
    const { result } = setup();
    expect(result.current.logs).toEqual({ room: [], game: [], chat: [] });
    expect(result.current.notice).toBeNull();
  });

  it('sends nothing for a user who may not read logs', () => {
    const { result, webClient } = setup(withLevel(Level.IsUser | Level.IsRegistered));
    result.current.onSubmit(search({ userName: 'alice' }));

    expect(webClient.request.moderator.viewLogHistory).not.toHaveBeenCalled();
    expect(webClient.request.developer.viewLogHistory).not.toHaveBeenCalled();
  });

  it('sends viewLogHistory with the completed search', () => {
    const { result, webClient } = setup();
    result.current.onSubmit(search({ userName: 'alice', dateRange: 'today', maximumResults: 25 }));

    expect(webClient.request.moderator.viewLogHistory).toHaveBeenCalledTimes(1);
    const params = (webClient.request.moderator.viewLogHistory as any).mock.calls[0][0];
    expect(params).toMatchObject({ userName: 'alice', dateRange: 24, maximumResults: 25, logLocation: ['room', 'game', 'chat'] });
  });

  it('searches through the developer family for a developer who is not a moderator', () => {
    const { result, webClient } = setup(withLevel(Level.IsUser | Level.IsRegistered | Level.IsDeveloper));
    expect(result.current.developer).toBe(true);

    result.current.onSubmit(search({ userName: 'alice' }));

    expect(webClient.request.developer.viewLogHistory).toHaveBeenCalledTimes(1);
    expect(webClient.request.moderator.viewLogHistory).not.toHaveBeenCalled();
  });

  it('owns the reply to a developer search by its request id', () => {
    const { result, store, webClient } = setup(withLevel(Level.IsUser | Level.IsRegistered | Level.IsDeveloper));
    act(() => {
      result.current.onSubmit(search({ userName: 'alice' }));
    });
    const requestId = vi.mocked(webClient.request.developer.viewLogHistory).mock.lastCall?.[1];
    expect(requestId).toEqual(expect.any(String));
    act(() => {
      store.dispatch(server.Actions.viewLogs({ logs: [], requestId }));
    });
    expect(result.current.notice).toMatchObject({ message: 'Logs.notice.empty', severity: 'info' });
  });

  it('keeps a developer who is also a moderator on the moderator family', () => {
    const { result, webClient } = setup(withLevel(Level.IsUser | Level.IsRegistered | Level.IsModerator | Level.IsDeveloper));
    expect(result.current.developer).toBe(false);

    result.current.onSubmit(search({ userName: 'alice' }));

    expect(webClient.request.moderator.viewLogHistory).toHaveBeenCalledTimes(1);
    expect(webClient.request.developer.viewLogHistory).not.toHaveBeenCalled();
  });

  it('says there are no messages when a search comes back empty', () => {
    const { result, store, webClient } = setup();
    act(() => {
      result.current.onSubmit(search({ userName: 'alice' }));
    });
    const requestId = vi.mocked(webClient.request.moderator.viewLogHistory).mock.lastCall?.[1];
    act(() => {
      store.dispatch(server.Actions.viewLogs({ logs: [], requestId }));
    });
    expect(result.current.notice).toMatchObject({ message: 'Logs.notice.empty', severity: 'info' });

    act(() => {
      result.current.dismissNotice();
    });
    expect(result.current.notice).toBeNull();
  });

  it('reports a failed search', () => {
    const { result, store, webClient } = setup();
    act(() => {
      result.current.onSubmit(search({ userName: 'alice' }));
    });
    const requestId = vi.mocked(webClient.request.moderator.viewLogHistory).mock.lastCall?.[1];
    act(() => {
      store.dispatch(server.Actions.moderatorCommandFailed({ requestId, command: 'viewLogHistory', responseCode: 3, target: 'alice' }));
    });
    expect(result.current.notice).toMatchObject({ message: 'Logs.notice.failed', severity: 'error' });
  });

  it('explains a search the server never answered with the transport reason', () => {
    const { result, store, webClient } = setup();
    act(() => {
      result.current.onSubmit(search({ userName: 'alice' }));
    });
    const requestId = vi.mocked(webClient.request.moderator.viewLogHistory).mock.lastCall?.[1];
    act(() => {
      store.dispatch(server.Actions.moderatorCommandFailed({ requestId,
        command: 'viewLogHistory', responseCode: -1, target: 'alice', failure: WebsocketTypes.CommandFailure.Timeout,
      }));
    });
    expect(result.current.notice).toMatchObject({ message: 'CommandFailure.timeout', severity: 'error' });
  });

  it('ignores log responses it did not ask for', () => {
    const { result, store } = setup();
    act(() => {
      store.dispatch(server.Actions.viewLogs({ logs: [] }));
    });
    expect(result.current.notice).toBeNull();
  });

  it('clears the logs slice on unmount', () => {
    // Assert the effect's observable result rather than spying on dispatch:
    // useAppDispatch() captures the store's original dispatch at render time,
    // so a post-render vi.spyOn would never see the cleanup call.
    const stateWithLogs = {
      ...withLevel(Level.IsUser | Level.IsRegistered | Level.IsModerator),
      server: {
        ...(withLevel(Level.IsUser | Level.IsRegistered | Level.IsModerator).server as any),
        logs: { room: [{ message: 'entry' }], game: [], chat: [] },
      },
    };
    const { unmount, store } = setup(stateWithLogs as Partial<RootState>);
    expect(store.getState().server.logs.room).toHaveLength(1);

    unmount();

    expect(store.getState().server.logs.room).toHaveLength(0);
  });
});


describe('log request ownership', () => {
  it('queues every overlapping search outcome, including replies received in one batch', () => {
    const { result, store, webClient } = setup();
    act(() => {
      result.current.onSubmit(search({ userName: 'alice' }));
      result.current.onSubmit(search({ userName: 'bob' }));
    });
    const [first, second] = vi.mocked(webClient.request.moderator.viewLogHistory).mock.calls;
    act(() => {
      store.dispatch(server.Actions.moderatorCommandFailed({
        command: 'viewLogHistory', target: 'bob', responseCode: 3,
        failure: WebsocketTypes.CommandFailure.Timeout, requestId: second[1],
      }));
      store.dispatch(server.Actions.viewLogs({ logs: [], requestId: first[1] }));
    });
    expect(result.current.notice?.message).toBe('CommandFailure.timeout');
    act(() => result.current.dismissNotice());
    expect(result.current.notice?.message).toBe('Logs.notice.empty');
    act(() => result.current.dismissNotice());
    expect(result.current.notice).toBeNull();
    expect(first[1]).toEqual(expect.any(String));
    expect(first[1]).not.toBe(second[1]);
  });

  it('ignores foreign and duplicate replies while another search is outstanding', () => {
    const { result, store, webClient } = setup();
    act(() => {
      result.current.onSubmit(search({ userName: 'alice' }));
      result.current.onSubmit(search({ userName: 'alice' }));
    });
    const [first, second] = vi.mocked(webClient.request.moderator.viewLogHistory).mock.calls;
    act(() => {
      store.dispatch(server.Actions.viewLogs({ logs: [], requestId: 'foreign' }));
      store.dispatch(server.Actions.viewLogs({ logs: [] }));
      store.dispatch(server.Actions.moderatorCommandFailed({
        command: 'banHistory', target: 'alice', responseCode: 3, requestId: first[1],
      }));
    });
    expect(result.current.notice).toBeNull();
    act(() => store.dispatch(server.Actions.viewLogs({ logs: [], requestId: first[1] })));
    expect(result.current.notice?.message).toBe('Logs.notice.empty');
    act(() => result.current.dismissNotice());
    act(() => store.dispatch(server.Actions.moderatorCommandFailed({
      command: 'viewLogHistory', target: 'alice', responseCode: 3, requestId: first[1],
    })));
    expect(result.current.notice).toBeNull();
    act(() => store.dispatch(server.Actions.moderatorCommandFailed({
      command: 'viewLogHistory', target: 'alice', responseCode: 3, requestId: second[1],
    })));
    expect(result.current.notice?.message).toBe('Logs.notice.failed');
  });

  it('keeps owned result rows when a foreign search updates the shared logs slice', () => {
    const { result, store, webClient } = setup();
    act(() => result.current.onSubmit(search({ userName: 'alice' })));
    const requestId = vi.mocked(webClient.request.moderator.viewLogHistory).mock.calls[0][1];
    act(() => store.dispatch(server.Actions.viewLogs({
      logs: [create(ServerInfo_ChatMessageSchema, { message: 'Owned row', targetType: 'room' })], requestId,
    })));
    expect(result.current.logs.room[0]?.message).toBe('Owned row');
    act(() => store.dispatch(server.Actions.viewLogs({ logs: [], requestId: 'foreign' })));
    expect(result.current.logs.room[0]?.message).toBe('Owned row');
    expect(result.current.notice).toBeNull();
  });

  it('ignores old-session replies and still settles a new search', () => {
    const { result, store, webClient } = setup();
    act(() => result.current.onSubmit(search({ userName: 'alice' })));
    const oldId = vi.mocked(webClient.request.moderator.viewLogHistory).mock.calls[0][1];
    act(() => {
      store.dispatch(server.Actions.clearStore());
      store.dispatch(server.Actions.updateInfo({ info: { name: 'Servatrice', version: '3.1.0' } }));
      store.dispatch(server.Actions.updateUser({ user: makeUser({ userLevel: Level.IsUser | Level.IsRegistered | Level.IsModerator }) }));
    });
    act(() => result.current.onSubmit(search({ userName: 'alice' })));
    const requestId = vi.mocked(webClient.request.moderator.viewLogHistory).mock.calls[1][1];
    act(() => store.dispatch(server.Actions.moderatorCommandFailed({
      command: 'viewLogHistory', target: 'alice', responseCode: 3, requestId: oldId,
    })));
    expect(result.current.notice).toBeNull();
    act(() => store.dispatch(server.Actions.viewLogs({ logs: [], requestId })));
    expect(result.current.notice?.message).toBe('Logs.notice.empty');
  });
});
