import { act, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { toBinary } from '@bufbuild/protobuf';

import { GameReplaySchema } from '@cockatrice/sockatrice/generated';
import { server } from '@cockatrice/datatrice';
import { closeReplay, getOpenedReplays, openReplay } from '@app/services';
import { endSession } from '@app/services/session';
import { RouteEnum } from '@app/types';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { buildReplay, sayContainer } from '../../services/replay/__mocks__/fixtures';
import { clearReplayCache, useReplayPreview, type ReplayPreviewState } from './useReplayPreview';

const bytes = () => toBinary(GameReplaySchema, buildReplay([sayContainer(0), sayContainer(4)]));

function setup() {
  let state: ReplayPreviewState;
  const webClient = createMockWebClient();
  function Probe() {
    state = useReplayPreview();
    return null;
  }
  const view = renderWithProviders(
    <Routes>
      <Route path={RouteEnum.REPLAYS} element={<Probe />} />
      <Route path={RouteEnum.REPLAY} element={<div data-testid="replay-view" />} />
    </Routes>,
    { route: RouteEnum.REPLAYS, webClient },
  );
  return { ...view, webClient, get state() {
    return state!;
  } };
}

afterEach(() => {
  clearReplayCache();
  getOpenedReplays().forEach(({ key }) => closeReplay(key));
});

describe('useReplayPreview', () => {
  it('fetches, parses and runs the replay once, then serves the next preview of it from the cache', async () => {
    const view = setup();
    const fetch = vi.fn().mockResolvedValue(bytes());

    act(() => view.state.load({ key: 'server:70', title: 'Game 7', fetch }));
    expect(view.state.status).toBe('loading');
    await waitFor(() => expect(view.state.status).toBe('ready'));

    const first = view.state.opened!;
    expect(first.gameId).toBeLessThan(-1000);
    expect(view.webClient.loadReplayGame).toHaveBeenCalledWith(first.gameId, first.replay.gameInfo);
    expect(getOpenedReplays()).toHaveLength(0);

    act(() => view.state.reset());
    expect(view.webClient.unloadReplayGame).toHaveBeenCalledWith(first.gameId);
    expect(view.state.status).toBe('idle');

    act(() => view.state.load({ key: 'server:70', title: 'Game 7', fetch }));
    expect(view.state.status).toBe('ready');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(view.state.opened!.replay).toBe(first.replay);
  });

  it('reports a fetch failure and an unreadable file without leaving a game loaded', async () => {
    const view = setup();

    act(() => view.state.load({ key: 'a', title: 'A', fetch: () => Promise.reject(new Error('offline')) }));
    await waitFor(() => expect(view.state.status).toBe('error'));
    expect(view.state.error).toBe('offline');

    act(() => view.state.load({ key: 'b', title: 'B', fetch: () => Promise.resolve(new Uint8Array([1, 2, 3])) }));
    await waitFor(() => expect(view.state.status).toBe('error'));
    expect(view.webClient.loadReplayGame).not.toHaveBeenCalled();
  });

  it('ignores a download that finishes after another preview was requested', async () => {
    const view = setup();
    let resolveSlow: (value: Uint8Array) => void = () => {};
    const slow = new Promise<Uint8Array>((resolve) => {
      resolveSlow = resolve;
    });

    act(() => view.state.load({ key: 'slow', title: 'Slow', fetch: () => slow }));
    act(() => view.state.load({ key: 'fast', title: 'Fast', fetch: () => Promise.resolve(bytes()) }));
    await waitFor(() => expect(view.state.status).toBe('ready'));
    await act(async () => {
      resolveSlow(bytes());
      await slow;
    });

    expect(view.state.key).toBe('fast');
    expect(view.webClient.loadReplayGame).toHaveBeenCalledTimes(1);
  });

  it('scopes the cache to the session: a new session epoch fetches again, and ending the session empties it', async () => {
    const view = setup();
    const fetch = vi.fn().mockResolvedValue(bytes());
    const source = { key: 'server:70', title: 'Game 7', fetch };

    act(() => view.state.load(source));
    await waitFor(() => expect(view.state.status).toBe('ready'));

    act(() => {
      view.store.dispatch(server.Actions.disconnected());
    });
    expect(view.state.status).toBe('idle');
    act(() => view.state.load(source));
    expect(view.state.status).toBe('loading');
    await waitFor(() => expect(view.state.status).toBe('ready'));
    expect(fetch).toHaveBeenCalledTimes(2);

    act(() => view.state.reset());
    endSession();
    act(() => view.state.load(source));
    await waitFor(() => expect(view.state.status).toBe('ready'));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not cache a download that finishes after the preview unmounted and the session ended', async () => {
    const view = setup();
    let resolveSlow: (value: Uint8Array) => void = () => {};
    const slow = new Promise<Uint8Array>((resolve) => {
      resolveSlow = resolve;
    });
    const source = { key: 'server:70', title: 'Game 7', fetch: vi.fn().mockReturnValue(slow) };

    act(() => view.state.load(source));
    view.unmount();
    endSession();
    await act(async () => {
      resolveSlow(bytes());
      await slow;
    });

    const next = setup();
    act(() => next.state.load({ ...source, fetch: vi.fn().mockResolvedValue(bytes()) }));
    expect(next.state.status).toBe('loading');
    await waitFor(() => expect(next.state.status).toBe('ready'));
    expect(next.webClient.loadReplayGame).toHaveBeenCalledTimes(1);
  });

  it('draws preview and tab game ids from one sequence', async () => {
    const view = setup();
    act(() => view.state.load({ key: 'server:70', title: 'Game 7', fetch: () => Promise.resolve(bytes()) }));
    await waitFor(() => expect(view.state.status).toBe('ready'));
    const previewId = view.state.opened!.gameId;

    const tab = openReplay(buildReplay([sayContainer(0)]), 'tab', view.webClient);
    expect(getOpenedReplays().find((r) => r.key === tab)!.gameId).toBe(previewId - 1);

    act(() => view.state.load({ key: 'server:71', title: 'Game 7', fetch: () => Promise.resolve(bytes()) }));
    await waitFor(() => expect(view.state.opened?.key).toBe('server:71'));
    expect(view.state.opened!.gameId).toBe(previewId - 2);
  });

  it('opens the full replay at the preview position when watching from a time', async () => {
    const view = setup();
    act(() => view.state.load({ key: 'server:70', title: 'Game 7', fetch: () => Promise.resolve(bytes()) }));
    await waitFor(() => expect(view.state.status).toBe('ready'));

    act(() => view.state.watchFrom(4000));

    const opened = getOpenedReplays();
    expect(opened).toHaveLength(1);
    expect(opened[0].title).toBe('Game 7');
    expect(opened[0].engine.getState().currentTime).toBe(4000);
    expect(view.getByTestId('replay-view')).toBeInTheDocument();
  });
});
