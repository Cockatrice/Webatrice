import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { games, type GamesState } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import type { WebClient } from '@cockatrice/sockatrice';
import { createMockWebClient } from '../../__test-utils__';
import { closeReplay, getOpenedReplay, getOpenedReplays, openReplay, type OpenedReplay } from '@app/services';
import { buildReplay, sayContainer } from '../../services/replay/__mocks__/fixtures';
import { getSettings, settingsStore } from '../../hooks/useSettings';

import type { ReplayShortcutBinder } from './replayShortcuts';
import { useReplayPlayback } from './useReplayPlayback';

function setup(opened: OpenedReplay | undefined, useShortcuts?: ReplayShortcutBinder) {
  const store = configureStore({
    reducer: { games: games.gamesReducer },
    preloadedState: { games: { games: {}, pings: {} } as GamesState },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext.Provider value={createMockWebClient() as WebClient}>{children}</WebClientContext.Provider>
      </Provider>
    );
  }
  const hook = renderHook(() => useReplayPlayback(opened, useShortcuts), { wrapper: Wrapper });
  return { ...hook, store };
}

function open() {
  const webClient = createMockWebClient();
  const replay = buildReplay([sayContainer(0, 'first'), sayContainer(1, 'second'), sayContainer(3, 'third')]);
  const opened = getOpenedReplay(openReplay(replay, 'fixture.cor', webClient))!;
  return { opened, webClient };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  getOpenedReplays().forEach(({ key }) => closeReplay(key));
  settingsStore.reset();
  vi.useRealTimers();
});

describe('useReplayPlayback', () => {
  it('hands its actions to the shortcut binder, enabled only while a replay is open', () => {
    const bind = vi.fn<ReplayShortcutBinder>();
    setup(undefined, bind);
    expect(bind).toHaveBeenLastCalledWith(expect.objectContaining({ togglePlay: expect.any(Function) }), false);

    const { opened } = open();
    setup(opened, bind);
    expect(bind).toHaveBeenLastCalledWith(expect.any(Object), true);
    bind.mock.lastCall![0].togglePlay();
    expect(opened.engine.getState().playing).toBe(true);
  });

  it('shows the opened replay at its start', () => {
    const { opened } = open();
    const { result } = setup(opened);

    expect(result.current.state).toMatchObject({ currentTime: 0, maxTime: 3000, totalEvents: 3 });
    expect(result.current.timeline).toBe(opened.engine.timeline);
  });

  it('never writes into the games slice itself', () => {
    const { opened } = open();
    const { store } = setup(opened);
    expect(store.getState().games.games).toEqual({});
  });

  it('feeds recorded containers to the replay game through the web client while playing', () => {
    const { opened, webClient } = open();
    const { result } = setup(opened);

    act(() => result.current.togglePlay());
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    const feed = vi.mocked(webClient.replayGameEventContainer);
    expect(feed.mock.calls.map(([container, gameId]) => [container.secondsElapsed, gameId])).toEqual([
      [0, opened.gameId],
      [1, opened.gameId],
    ]);
    expect(result.current.state.playing).toBe(true);
  });

  it('keeps the replay and its position when the view unmounts, and resumes there', () => {
    const { opened, webClient } = open();
    const first = setup(opened);
    act(() => first.result.current.seek(1000));
    act(() => first.result.current.toggleFastForward());

    first.unmount();
    expect(webClient.unloadReplayGame).not.toHaveBeenCalled();

    const second = setup(opened);
    expect(second.result.current.state.currentTime).toBe(1000);
    expect(second.result.current.fastForward).toBe(true);
    expect(second.result.current.state.timeScaleFactor).toBe(10);
  });

  it('seeking backwards reloads the game before replaying up to the target', () => {
    const { opened, webClient } = open();
    const { result } = setup(opened);
    act(() => result.current.seek(3000));
    expect(webClient.loadReplayGame).toHaveBeenCalledTimes(1);

    act(() => result.current.seek(500));

    expect(webClient.loadReplayGame).toHaveBeenCalledTimes(2);
    expect(vi.mocked(webClient.replayGameEventContainer).mock.calls.at(-1)?.[0].secondsElapsed).toBe(0);
  });

  it('fast forward speeds the clock up by the configured factor', () => {
    const { result } = setup(open().opened);

    act(() => result.current.toggleFastForward());

    expect(result.current.fastForward).toBe(true);
    expect(result.current.state.timeScaleFactor).toBe(10);
  });

  it('buffers backward skips for the time set in User Interface › Replay', async () => {
    const { opened, webClient } = open();
    const { result } = setup(opened);
    act(() => result.current.seek(3000));

    act(() => result.current.skipBy(-1000));
    expect(webClient.loadReplayGame).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(webClient.loadReplayGame).toHaveBeenCalledTimes(2);

    await act(async () => {
      const settings = await getSettings();
      settings.replayRewindBufferingMs = 0;
      settingsStore.setValue(settings);
    });
    act(() => result.current.skipBy(-1000));

    expect(webClient.loadReplayGame).toHaveBeenCalledTimes(3);
  });

  it('updates fast-forward speed and empty-section skipping when preferences change', async () => {
    const { result } = setup(open().opened);
    act(() => result.current.toggleFastForward());

    await act(async () => {
      const settings = await getSettings();
      settings.replayFastForwardSpeed = 5;
      settings.replaySkipEmptySections = true;
      settingsStore.setValue(settings);
    });

    expect(result.current.fastForwardSpeed).toBe(5);
    expect(result.current.state.timeScaleFactor).toBe(5);
    expect(result.current.state.skipEmptySections).toBe(true);
  });

  it('is idle without an opened replay', () => {
    const { result } = setup(undefined);

    expect(result.current.state).toMatchObject({ maxTime: 0, playing: false });
    expect(result.current.timeline).toEqual([]);
  });
});
