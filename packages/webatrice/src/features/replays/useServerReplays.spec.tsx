import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_ReplayMatchSchema, ServerInfo_ReplaySchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { ReplayFileDTO } from '@app/services';
import { endSession } from '@app/services/session';
import { connectedState, createMockWebClient, makeStoreState, makeUser, renderWithProviders } from '../../__test-utils__';
import { useServerReplays, type ServerReplays } from './useServerReplays';

const match = (gameId: number) => create(ServerInfo_ReplayMatchSchema, { gameId, gameName: `Game ${gameId}`, doNotHide: false });

function setup() {
  let model: ServerReplays;
  let client = createMockWebClient();
  function Probe() {
    model = useServerReplays();
    return null;
  }
  const ui = () => <WebClientContext.Provider value={client}><Probe /></WebClientContext.Provider>;
  const view = renderWithProviders(ui(), {
    preloadedState: makeStoreState({
      ...connectedState,
      server: {
        ...connectedState.server,
        user: makeUser({ userLevel: ServerInfo_User_UserLevelFlag.IsUser | ServerInfo_User_UserLevelFlag.IsRegistered }),
      },
    }),
    webClient: client,
  });
  return {
    ...view,
    get model() {
      return model!;
    },
    requestId: () => vi.mocked(client.request.session.replayList).mock.lastCall?.[0],
    requestCount: () => vi.mocked(client.request.session.replayList).mock.calls.length,
    replayDownload: () => vi.mocked(client.request.session.replayDownload),
    refresh: () => {
      client = createMockWebClient();
      view.rerender(ui());
    },
    succeed: (requestId: string | undefined, gameId: number) => act(() => {
      view.store.dispatch(server.Actions.replayList({ matchList: [match(gameId)], requestId }));
    }),
    fail: (requestId: string | undefined) => act(() => {
      view.store.dispatch(server.Actions.replayListFailed({
        responseCode: -1, failure: WebsocketTypes.CommandFailure.Timeout, requestId,
      }));
    }),
  };
}

describe('server replay refresh ownership', () => {
  it('lets only the newest refresh end the loading state', () => {
    const view = setup();
    const first = view.requestId();
    view.refresh();
    const second = view.requestId();

    view.succeed(first, 1);
    expect(view.model.loading).toBe(true);

    view.succeed(second, 2);
    expect(view.model.loading).toBe(false);
  });

  it.each([false, true])('ignores a stale failure when the newer refresh has settled: %s', (settled) => {
    const view = setup();
    const first = view.requestId();
    view.refresh();
    const second = view.requestId();
    if (settled) {
      view.succeed(second, 2);
    }

    view.fail(first);

    expect(view.model.notice).toBeNull();
    expect(view.model.loading).toBe(!settled);
  });

  it('settles the current failure once and rejects later outcomes for that request', () => {
    const view = setup();
    const requestId = view.requestId();
    expect(requestId).toEqual(expect.any(String));
    view.fail(requestId);
    expect(view.model.loading).toBe(false);
    expect(view.model.notice?.message).toBe('CommandFailure.timeout');
    act(() => view.model.dismissNotice());
    view.fail(requestId);
    expect(view.model.notice).toBeNull();
  });

  it('raises no notice for a refresh that outlived its session', () => {
    const view = setup();
    const requestId = view.requestId();
    act(() => endSession());
    view.fail(requestId);
    expect(view.model.notice).toBeNull();
  });
});

describe('saving to the library across a session boundary', () => {
  const recorded = create(ServerInfo_ReplayMatchSchema, {
    gameId: 7,
    gameName: 'Game 7',
    doNotHide: false,
    replayList: [create(ServerInfo_ReplaySchema, { replayId: 70, replayName: 'Replay 70', duration: 10 })],
  });

  function selectMatch(view: ReturnType<typeof setup>) {
    act(() => {
      view.store.dispatch(server.Actions.replayList({ matchList: [recorded], requestId: view.requestId() }));
    });
    act(() => view.model.select({ kind: 'match', gameId: 7 }));
  }

  it('downloads nothing when the session ended while the folder was being created', async () => {
    let resolveFolder: (id: number) => void = () => {};
    vi.spyOn(ReplayFileDTO, 'addFolder').mockReturnValue(new Promise((resolve) => {
      resolveFolder = resolve;
    }));
    const view = setup();
    selectMatch(view);

    act(() => view.model.saveToLibrary(1));
    act(() => endSession());
    await act(async () => {
      resolveFolder(11);
    });

    expect(view.replayDownload()).not.toHaveBeenCalled();
  });

  it('persists nothing when the session ended while the replay was downloading', async () => {
    vi.spyOn(ReplayFileDTO, 'addFolder').mockResolvedValue(11);
    const add = vi.spyOn(ReplayFileDTO, 'addReplay').mockResolvedValue(12);
    const view = setup();
    selectMatch(view);

    act(() => view.model.saveToLibrary(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.replayDownload()).toHaveBeenCalledTimes(1);

    act(() => endSession());
    const deliver = view.replayDownload().mock.lastCall![1] as (data: Uint8Array) => void;
    await act(async () => {
      deliver(new Uint8Array([1]));
    });

    expect(add).not.toHaveBeenCalled();
    expect(view.model.librarySaves).toBe(0);
  });
});
