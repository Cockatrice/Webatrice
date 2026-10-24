import type { GameEventContainer } from '@cockatrice/sockatrice/generated';

import { buildReplay, pingContainer, sayContainer } from './__mocks__/fixtures';
import { MIN_TICK_INTERVAL_MS, ReplayEngine, type ReplaySink } from './ReplayEngine';

function makeSink() {
  const applied: number[] = [];
  let rewinds = 0;
  const sink: ReplaySink = {
    rewind: () => {
      rewinds++;
      applied.length = 0;
    },
    apply: (container: GameEventContainer) => {
      applied.push(container.secondsElapsed);
    },
  };
  return { sink, applied, rewinds: () => rewinds };
}

function makeEngine(containers: GameEventContainer[], options = {}) {
  const sink = makeSink();
  const engine = new ReplayEngine(buildReplay(containers), sink.sink, options);
  engine.load();
  return { engine, ...sink };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('ReplayEngine loading', () => {
  it('rewinds the target game and applies nothing at time 0', () => {
    const { engine, applied, rewinds } = makeEngine([sayContainer(0), sayContainer(1)]);

    expect(rewinds()).toBe(1);
    expect(applied).toEqual([]);
    expect(engine.getState()).toMatchObject({ currentTime: 0, maxTime: 1000, playing: false, finished: false });
  });

  it('finishes immediately when the replay has no events', () => {
    const { engine } = makeEngine([]);
    expect(engine.getState().finished).toBe(true);
  });
});

describe('ReplayEngine playback timing', () => {
  it('applies each event once the 200 ms clock passes its timeline position', () => {
    const { engine, applied } = makeEngine([sayContainer(0), sayContainer(1), sayContainer(3)]);

    engine.play();
    vi.advanceTimersByTime(200);
    expect(applied).toEqual([0]);

    vi.advanceTimersByTime(800);
    expect(applied).toEqual([0]);
    vi.advanceTimersByTime(200);
    expect(applied).toEqual([0, 1]);

    vi.advanceTimersByTime(2000);
    expect(applied).toEqual([0, 1, 3]);
    expect(engine.getState()).toMatchObject({ playing: false, finished: true, currentTime: 3000 });
  });

  it('pauses and resumes without losing position', () => {
    const { engine, applied } = makeEngine([sayContainer(0), sayContainer(2)]);

    engine.play();
    vi.advanceTimersByTime(1000);
    engine.pause();
    vi.advanceTimersByTime(5000);
    expect(applied).toEqual([0]);
    expect(engine.getState()).toMatchObject({ currentTime: 1000, playing: false });

    engine.togglePlay();
    vi.advanceTimersByTime(1200);
    expect(applied).toEqual([0, 2]);
  });

  it('runs the clock faster by the time scale factor', () => {
    const { engine, applied } = makeEngine([sayContainer(0), sayContainer(10)]);

    engine.setTimeScaleFactor(10);
    engine.play();
    vi.advanceTimersByTime(1050);
    expect(applied).toEqual([0, 10]);
    expect(engine.getState().timeScaleFactor).toBe(10);
  });

  it('keeps pace at speeds whose 200 ms tick would be shorter than a browser timer allows', () => {
    const { engine, applied } = makeEngine([sayContainer(0), sayContainer(60), sayContainer(120)]);
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.setTimeScaleFactor(99.9);
    engine.play();
    listener.mockClear();
    vi.advanceTimersByTime(1250);

    expect(applied).toEqual([0, 60, 120]);
    expect(engine.getState().finished).toBe(true);
    expect(listener.mock.calls.length).toBeLessThanOrEqual(1250 / MIN_TICK_INTERVAL_MS + 1);
  });

  it('notifies subscribers with a fresh snapshot on every tick', () => {
    const { engine } = makeEngine([sayContainer(0), sayContainer(5)]);
    const listener = vi.fn();
    engine.subscribe(listener);
    const before = engine.getState();

    engine.play();
    vi.advanceTimersByTime(400);

    expect(listener).toHaveBeenCalled();
    expect(engine.getState()).not.toBe(before);
    expect(engine.getState().currentTime).toBe(400);
  });
});

describe('ReplayEngine seeking', () => {
  it('seeking forward replays every event in the gap', () => {
    const { engine, applied, rewinds } = makeEngine([sayContainer(0), sayContainer(1), sayContainer(4), sayContainer(9)]);

    engine.seek(4500);

    expect(applied).toEqual([0, 1, 4]);
    expect(rewinds()).toBe(1);
    expect(engine.getState().currentTime).toBe(4400);
  });

  it('seeking backward resets the game and fast-replays up to the target', () => {
    const { engine, applied, rewinds } = makeEngine([sayContainer(0), sayContainer(1), sayContainer(4), sayContainer(9)]);
    engine.seek(9000);
    expect(applied).toEqual([0, 1, 4]);

    engine.seek(2000);

    expect(rewinds()).toBe(2);
    expect(applied).toEqual([0, 1]);
    expect(engine.getState().processedEvents).toBe(2);
  });

  it('counts its rewinds, the new count readable before the sink is rewound', () => {
    const { engine, sink } = makeEngine([sayContainer(0), sayContainer(4)]);
    const seenBySink: number[] = [];
    const rewind = sink.rewind;
    sink.rewind = () => {
      seenBySink.push(engine.getRewindCount());
      rewind();
    };
    expect(engine.getRewindCount()).toBe(1);
    engine.seek(5000);
    expect(engine.getRewindCount()).toBe(1);
    engine.seek(1000);
    expect(engine.getRewindCount()).toBe(2);
    expect(seenBySink).toEqual([2]);
  });

  it('reaches the same state by seeking as by playing to the same time', () => {
    const containers = [sayContainer(0), sayContainer(1), sayContainer(1), sayContainer(3), sayContainer(6)];
    const played = makeEngine(containers);
    played.engine.play();
    vi.advanceTimersByTime(3600);

    const seeked = makeEngine(containers);
    seeked.engine.seek(6000);
    seeked.engine.seek(3600);

    expect(seeked.applied).toEqual(played.applied);
  });

  it('clamps seeks to the replay bounds and snaps to the clock interval', () => {
    const { engine } = makeEngine([sayContainer(0), sayContainer(3)]);

    engine.seek(-500);
    expect(engine.getState().currentTime).toBe(0);
    engine.seek(1999);
    expect(engine.getState().currentTime).toBe(1800);
    engine.seek(99999);
    expect(engine.getState().currentTime).toBe(3000);
  });

  it('skipBy moves relative to the current time', () => {
    const { engine, applied } = makeEngine([sayContainer(0), sayContainer(1), sayContainer(12)]);

    engine.skipBy(1000);
    expect(engine.getState().currentTime).toBe(1000);
    engine.skipBy(10000);
    expect(applied).toEqual([0, 1]);
    expect(engine.getState().currentTime).toBe(11000);
  });

  it('buffers rapid backward skips into a single rewind', () => {
    const { engine, rewinds, applied } = makeEngine([sayContainer(0), sayContainer(5), sayContainer(9)], {
      rewindBufferingMs: 200,
    });
    engine.seek(9000);
    expect(rewinds()).toBe(1);

    engine.skipBy(-1000);
    engine.skipBy(-1000);
    engine.skipBy(-1000);
    expect(rewinds()).toBe(1);
    expect(engine.getState().currentTime).toBe(6000);

    vi.advanceTimersByTime(200);
    expect(rewinds()).toBe(2);
    expect(applied).toEqual([0, 5]);
  });

  it('follows a changed buffer time from the next backward skip', () => {
    const { engine, rewinds } = makeEngine([sayContainer(0), sayContainer(5), sayContainer(9)], {
      rewindBufferingMs: 200,
    });
    engine.seek(9000);

    engine.setRewindBufferingMs(1000);
    engine.skipBy(-1000);
    vi.advanceTimersByTime(999);
    expect(rewinds()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(rewinds()).toBe(2);

    engine.setRewindBufferingMs(0);
    engine.skipBy(-1000);
    expect(rewinds()).toBe(3);
  });

  it('a backward seek from a click rewinds without buffering', () => {
    const { engine, rewinds } = makeEngine([sayContainer(0), sayContainer(5)], { rewindBufferingMs: 200 });
    engine.seek(5000);
    engine.seek(1000);
    expect(rewinds()).toBe(2);
  });

  it('seeking back after the end clears the finished state', () => {
    const { engine } = makeEngine([sayContainer(0), sayContainer(1)]);
    engine.play();
    vi.advanceTimersByTime(1400);
    expect(engine.getState().finished).toBe(true);

    engine.seek(0);
    expect(engine.getState().finished).toBe(false);
  });
});

describe('ReplayEngine skip-empty', () => {
  const quietMinute = [
    sayContainer(0),
    ...Array.from({ length: 58 }, (_, i) => pingContainer(i + 1)),
    sayContainer(60),
  ];

  it('plays through empty sections in real time when disabled', () => {
    const { engine, applied } = makeEngine(quietMinute);
    engine.play();
    vi.advanceTimersByTime(5000);
    expect(applied).not.toContain(60);
    expect(engine.getState().currentTime).toBe(5000);
  });

  it('jumps to just before the next meaningful event when enabled', () => {
    const { engine, applied } = makeEngine(quietMinute, { skipEmptySections: true });
    engine.play();
    vi.advanceTimersByTime(1000);

    expect(engine.getState().currentTime).toBeGreaterThanOrEqual(59400);
    expect(applied).not.toContain(60);
    vi.advanceTimersByTime(1000);
    expect(applied).toContain(60);
  });

  it('can be toggled while playing', () => {
    const { engine } = makeEngine(quietMinute);
    engine.play();
    vi.advanceTimersByTime(2000);
    engine.setSkipEmptySections(true);
    vi.advanceTimersByTime(200);
    expect(engine.getState()).toMatchObject({ skipEmptySections: true });
    expect(engine.getState().currentTime).toBeGreaterThanOrEqual(59400);
  });
});

describe('ReplayEngine reveal windows', () => {
  it('shows every reveal during playback, even when one tick advances more than ten seconds', () => {
    const containers = [sayContainer(0), sayContainer(1), sayContainer(20)];
    const { engine, sink } = makeEngine(containers);
    const apply = vi.spyOn(sink, 'apply');
    engine.setTimeScaleFactor(1000);
    engine.play();
    vi.advanceTimersByTime(50);

    expect(apply.mock.calls).toEqual(containers.map((container) => [container, { skipRevealWindow: false }]));
  });

  it('shows reveals during a small forward seek', () => {
    const containers = [sayContainer(0), sayContainer(1), sayContainer(20)];
    const { engine, sink } = makeEngine(containers);
    const apply = vi.spyOn(sink, 'apply');
    engine.seek(2000);

    expect(apply.mock.calls).toEqual(containers.slice(0, 2).map((container) => [container, { skipRevealWindow: false }]));
  });

  it('skips only events strictly more than ten seconds before a forward seek target', () => {
    const containers = [sayContainer(0), sayContainer(9), sayContainer(10), sayContainer(11), sayContainer(20)];
    const { engine, sink } = makeEngine(containers);
    const apply = vi.spyOn(sink, 'apply');
    engine.seek(20000);

    expect(apply.mock.calls).toEqual([
      [containers[0], { skipRevealWindow: true }],
      [containers[1], { skipRevealWindow: true }],
      [containers[2], { skipRevealWindow: false }],
      [containers[3], { skipRevealWindow: false }],
    ]);
  });

  it.each([false, true])('skips every reveal on a rewind (buffered=%s), then shows playback reveals', (buffered) => {
    const containers = [sayContainer(0), sayContainer(1), sayContainer(5), sayContainer(20)];
    const { engine, sink } = makeEngine(containers);
    engine.seek(20000);
    const apply = vi.spyOn(sink, 'apply');
    if (buffered) {
      engine.skipBy(-18000);
      expect(apply).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
    } else {
      engine.seek(2000);
    }
    expect(apply.mock.calls).toEqual(containers.slice(0, 2).map((container) => [container, { skipRevealWindow: true }]));
    engine.play();
    vi.advanceTimersByTime(3200);
    expect(apply).toHaveBeenLastCalledWith(containers[2], { skipRevealWindow: false });
    engine.dispose();
  });
});

describe('ReplayEngine disposal', () => {
  it('stops the clock and drops subscribers', () => {
    const { engine, applied } = makeEngine([sayContainer(0), sayContainer(3)]);
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.play();
    engine.dispose();
    listener.mockClear();

    vi.advanceTimersByTime(5000);
    expect(applied).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });
});
