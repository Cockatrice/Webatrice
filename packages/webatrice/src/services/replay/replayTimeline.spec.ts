import { buildReplay, pingContainer, sayContainer } from './__mocks__/fixtures';
import { createReplayTimeline, createTimelineHistogram, hasMeaningfulEvent } from './replayTimeline';
import { toBinary } from '@bufbuild/protobuf';
import { GameReplaySchema } from '@cockatrice/sockatrice/generated';
import { parseReplay } from './parseReplay';

describe('createReplayTimeline', () => {
  it('places each event at its recorded second', () => {
    const replay = buildReplay([sayContainer(0), sayContainer(2), sayContainer(5)]);
    expect(createReplayTimeline(replay)).toEqual([0, 2000, 5000]);
  });

  it('spreads events recorded in the same second evenly across it', () => {
    const replay = buildReplay([sayContainer(0), sayContainer(3), sayContainer(3), sayContainer(3), sayContainer(4)]);
    expect(createReplayTimeline(replay)).toEqual([0, 3000, 3333, 3666, 4000]);
  });

  it('returns an empty timeline for a replay without events', () => {
    expect(createReplayTimeline(buildReplay([]))).toEqual([]);
  });
});

describe('hasMeaningfulEvent', () => {
  it('treats ping-only player property updates as empty', () => {
    expect(hasMeaningfulEvent(pingContainer(1))).toBe(false);
    expect(hasMeaningfulEvent(sayContainer(1))).toBe(true);
  });
});

describe('createTimelineHistogram', () => {
  it('bounds work and allocation for a crafted .cor with a uint32 timestamp', () => {
    const bytes = toBinary(GameReplaySchema, buildReplay([sayContainer(0), sayContainer(0xffffffff)]));
    const timeline = createReplayTimeline(parseReplay(bytes));
    const push = Array.prototype.push;
    Array.prototype.push = function boundedPush(this: number[], ...items: number[]) {
      if (this.length + items.length > 4096) {
        throw new Error('Unbounded histogram allocation');
      }
      return push.apply(this, items);
    };
    let histogram: number[];
    try {
      histogram = createTimelineHistogram(timeline);
    } finally {
      Array.prototype.push = push;
    }
    expect(histogram.length).toBeLessThanOrEqual(2048);
    expect(histogram[0]).toBe(1);
    expect(histogram.at(-1)).toBe(1);
    expect(histogram.reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  it('counts a dense timeline without spreading it onto the call stack', () => {
    const histogram = createTimelineHistogram(Array.from({ length: 150_000 }, (_, i) => i));
    expect(histogram.reduce((sum, count) => sum + count, 0)).toBe(150_000);
  });

  it('counts events per 5 second bin, including empty bins', () => {
    expect(createTimelineHistogram([0, 1000, 4999, 5000, 16000])).toEqual([3, 1, 0, 1]);
  });

  it('returns a single empty bin for an empty timeline', () => {
    expect(createTimelineHistogram([])).toEqual([0]);
  });
});
