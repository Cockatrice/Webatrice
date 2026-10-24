import { LATENCY_WINDOW_SIZE, LatencyTracker } from './LatencyTracker';

describe('LatencyTracker', () => {
  const fill = (tracker: LatencyTracker, samples: number[]) => samples.forEach((ms) => tracker.addSample(ms));
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it('yields zeroed stats when empty', () => {
    expect(new LatencyTracker().stats()).toEqual({ lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 });
  });

  it('reports a single sample as every statistic', () => {
    const tracker = new LatencyTracker();
    tracker.addSample(42);
    expect(tracker.stats()).toEqual({ lastMs: 42, medianMs: 42, p95Ms: 42, maxMs: 42, sampleCount: 1 });
  });

  it('takes the middle sample as the median and the nearest rank as p95 of an odd window', () => {
    const tracker = new LatencyTracker();
    fill(tracker, [50, 10, 30, 20, 40]);
    expect(tracker.stats()).toEqual({ lastMs: 40, medianMs: 30, p95Ms: 50, maxMs: 50, sampleCount: 5 });
  });

  it('averages the middle two samples for the median of an even window', () => {
    const tracker = new LatencyTracker();
    fill(tracker, [10, 20, 30, 40]);
    expect(tracker.stats()).toMatchObject({ sampleCount: 4, medianMs: 25, p95Ms: 40 });
  });

  it('evicts the oldest samples once the window is full', () => {
    const tracker = new LatencyTracker();
    fill(tracker, range(0, 99));
    expect(tracker.stats()).toEqual({ lastMs: 99, medianMs: 67, p95Ms: 96, maxMs: 99, sampleCount: LATENCY_WINDOW_SIZE });
  });

  it('resets all state on clear', () => {
    const tracker = new LatencyTracker();
    fill(tracker, range(0, 99));
    tracker.clear();
    expect(tracker.stats().sampleCount).toBe(0);
    tracker.addSample(7);
    expect(tracker.stats()).toMatchObject({ sampleCount: 1, lastMs: 7, medianMs: 7 });
  });

  it('keeps the last sample across the ring buffer wraparound', () => {
    const tracker = new LatencyTracker();
    fill(tracker, range(0, LATENCY_WINDOW_SIZE - 1));
    tracker.addSample(1000);
    expect(tracker.stats().lastMs).toBe(1000);
  });

  it('lists recent samples oldest first', () => {
    const tracker = new LatencyTracker();
    fill(tracker, [50, 10, 30]);
    expect(tracker.recentSamples()).toEqual([50, 10, 30]);
  });

  it('lists recent samples in order across the wraparound', () => {
    const tracker = new LatencyTracker();
    fill(tracker, range(0, 99));
    expect(tracker.recentSamples()).toEqual(range(36, 99));
  });

  it('lists no samples when fresh or cleared', () => {
    const tracker = new LatencyTracker();
    expect(tracker.recentSamples()).toEqual([]);
    tracker.addSample(5);
    tracker.clear();
    expect(tracker.recentSamples()).toEqual([]);
  });
});
