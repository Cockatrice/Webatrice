import { buildReplay, sayContainer } from './__mocks__/fixtures';
import {
  closeReplay,
  getOpenedReplay,
  getOpenedReplays,
  openReplay,
  subscribeOpenedReplays,
  type ReplayGameTarget,
} from './openedReplays';

function makeTarget(): ReplayGameTarget {
  return {
    loadReplayGame: vi.fn(),
    unloadReplayGame: vi.fn(),
    replayGameEventContainer: vi.fn(),
  } as unknown as ReplayGameTarget;
}

afterEach(() => {
  getOpenedReplays().forEach(({ key }) => closeReplay(key));
});

describe('openedReplays', () => {
  it('parks a replay under a fresh key with its own negative game id', () => {
    const target = makeTarget();
    const first = openReplay(buildReplay([sayContainer(0)]), 'one.cor', target);
    const second = openReplay(buildReplay([sayContainer(0)]), 'two.cor', target);

    expect(first).not.toBe(second);
    expect(getOpenedReplay(first)).toMatchObject({ key: first, title: 'one.cor' });
    expect(getOpenedReplay(first)!.gameId).toBeLessThan(0);
    expect(getOpenedReplay(first)!.gameId).not.toBe(getOpenedReplay(second)!.gameId);
    expect(getOpenedReplays().map(({ key }) => key)).toEqual([first, second]);
  });

  it('loads the replay game through the target when opened', () => {
    const target = makeTarget();
    const replay = buildReplay([sayContainer(0)]);
    const key = openReplay(replay, 'one.cor', target);

    expect(target.loadReplayGame).toHaveBeenCalledWith(getOpenedReplay(key)!.gameId, replay.gameInfo);
    expect(getOpenedReplay(key)!.engine.getState()).toMatchObject({ currentTime: 0, playing: false });
  });

  it('keeps playing until closed, then stops and unloads the replay game', () => {
    vi.useFakeTimers();
    const target = makeTarget();
    const key = openReplay(buildReplay([sayContainer(0), sayContainer(5)]), 'gone.cor', target);
    const { engine, gameId } = getOpenedReplay(key)!;
    engine.play();
    vi.advanceTimersByTime(400);
    expect(target.replayGameEventContainer).toHaveBeenCalledTimes(1);

    closeReplay(key);
    vi.advanceTimersByTime(10_000);

    expect(target.unloadReplayGame).toHaveBeenCalledWith(gameId);
    expect(target.replayGameEventContainer).toHaveBeenCalledTimes(1);
    expect(getOpenedReplay(key)).toBeUndefined();
    expect(getOpenedReplay(undefined)).toBeUndefined();
    vi.useRealTimers();
  });

  it('forwards the engine reveal options to the replay target', () => {
    const target = makeTarget();
    const containers = [sayContainer(0), sayContainer(10), sayContainer(20)];
    const key = openReplay(buildReplay(containers), 'reveals.cor', target);
    const { engine, gameId } = getOpenedReplay(key)!;

    engine.seek(20000);

    expect(target.replayGameEventContainer).toHaveBeenNthCalledWith(1, containers[0], gameId, { skipRevealWindow: true });
    expect(target.replayGameEventContainer).toHaveBeenNthCalledWith(2, containers[1], gameId, { skipRevealWindow: false });
  });

  it('notifies subscribers with a new snapshot on open and close only', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOpenedReplays(listener);
    const before = getOpenedReplays();

    const key = openReplay(buildReplay([sayContainer(0)]), 'one.cor', makeTarget());
    const opened = getOpenedReplays();
    expect(opened).not.toBe(before);
    expect(getOpenedReplays()).toBe(opened);

    closeReplay(key);
    closeReplay(key);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
