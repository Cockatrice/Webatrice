import { runPaced, type TaskOutcome } from './pacedQueue';

function clock() {
  let now = 0;
  const waits: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      waits.push(ms);
      now += ms;
    },
    waits,
  };
}

it('spaces tasks by the interval', async () => {
  const c = clock();
  const starts: number[] = [];
  await runPaced([1, 2, 3], async () => {
    starts.push(c.now());
    return 'ok';
  }, () => {}, { intervalMs: 1000, floodBackoffMs: 5000, maxFloodRetries: 2, now: c.now, sleep: c.sleep });
  expect(starts).toEqual([0, 1000, 2000]);
});

it('backs off and retries on flood, then reports the last outcome', async () => {
  const c = clock();
  const outcomes: TaskOutcome[] = ['flood', 'flood', 'ok'];
  const settled: string[] = [];
  await runPaced(['a'], async () => outcomes.shift()!, (_item, _i, outcome) => settled.push(outcome),
    { intervalMs: 100, floodBackoffMs: 1000, maxFloodRetries: 3, now: c.now, sleep: c.sleep });
  expect(settled).toEqual(['ok']);
  expect(c.waits.filter((ms) => ms >= 1000)).toEqual([1000, 2000]);
});

it('gives up on flood after the retry limit', async () => {
  const c = clock();
  const settled: string[] = [];
  await runPaced(['a'], async () => 'flood', (_item, _i, outcome) => settled.push(outcome),
    { intervalMs: 0, floodBackoffMs: 10, maxFloodRetries: 1, now: c.now, sleep: c.sleep });
  expect(settled).toEqual(['flood']);
});

it('stops when cancelled or when a task says stop', async () => {
  let cancelled = false;
  const result = await runPaced([1, 2, 3], async (item) => {
    cancelled = item === 2;
    return 'ok';
  }, () => {}, { intervalMs: 0, floodBackoffMs: 0, maxFloodRetries: 0, isCancelled: () => cancelled, sleep: async () => {} });
  expect(result).toEqual({ completed: 2, stopped: true });
  expect(await runPaced([1, 2], async () => 'stop', () => {}, { intervalMs: 0, floodBackoffMs: 0, maxFloodRetries: 0 }))
    .toEqual({ completed: 0, stopped: true });
});

it('does not send the next command when cancelled during the pacing wait', async () => {
  let now = 0;
  let cancelled = false;
  const sent: number[] = [];
  const sleep = async (ms: number) => {
    now += ms;
    cancelled = true;
  };
  const result = await runPaced([1, 2, 3], async (item) => {
    sent.push(item);
    return 'ok';
  }, () => {}, { intervalMs: 1200, floodBackoffMs: 0, maxFloodRetries: 0, now: () => now, sleep, isCancelled: () => cancelled });
  expect(sent).toEqual([1]);
  expect(result).toEqual({ completed: 1, stopped: true });
});

it('does not retry a flood after a cancel during the back-off', async () => {
  let cancelled = false;
  const settled: string[] = [];
  let calls = 0;
  await runPaced(['a'], async () => {
    calls += 1;
    return 'flood';
  }, (_item, _i, outcome) => settled.push(outcome), {
    intervalMs: 0, floodBackoffMs: 5000, maxFloodRetries: 3, sleep: async () => {
      cancelled = true;
    }, isCancelled: () => cancelled,
  });
  expect(calls).toBe(1);
  expect(settled).toEqual(['flood']);
});

it('settles skipped items without waiting or sending', async () => {
  const c = clock();
  const sent: number[] = [];
  const settled: Array<[number, string]> = [];
  await runPaced([1, 2, 3], async (item) => {
    sent.push(item);
    return 'ok';
  }, (item, _i, outcome) => settled.push([item, outcome]), {
    intervalMs: 1000, floodBackoffMs: 0, maxFloodRetries: 0, now: c.now, sleep: c.sleep, skip: (item) => item === 2,
  });
  expect(sent).toEqual([1, 3]);
  expect(settled).toEqual([[1, 'ok'], [2, 'skipped'], [3, 'ok']]);
  expect(c.waits).toEqual([1000]);
});
