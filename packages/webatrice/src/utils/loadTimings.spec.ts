import { performance as clock } from 'node:perf_hooks';

import { LOAD_TIMINGS, markLoadTiming, readLoadTimings } from './loadTimings';

beforeEach(() => {
  vi.stubGlobal('performance', clock);
  clock.clearMarks();
  clock.clearMeasures();
});
afterEach(() => vi.unstubAllGlobals());

it('measures milestones from boot and keeps first occurrence', () => {
  clock.mark('webatrice:boot-start', { startTime: 0 });
  markLoadTiming('app-render');
  const first = readLoadTimings();
  expect(first.map(row => row.name)).toEqual(LOAD_TIMINGS);
  expect(first[0].milliseconds).toBe(0);
  expect(first[1].milliseconds).toBeGreaterThan(0);
  expect(first[2].milliseconds).toBeUndefined();
  markLoadTiming('app-render');
  expect(readLoadTimings()).toEqual(first);
  expect(clock.getEntriesByName('webatrice:app-render', 'mark')).toHaveLength(1);
  expect(clock.getEntriesByName('webatrice:app-render', 'measure')).toHaveLength(1);
});

it('replaces the current route without accumulating entries', () => {
  markLoadTiming('boot-start');
  markLoadTiming('route-ready', '/server', true);
  markLoadTiming('route-ready', '/settings', true);
  expect(readLoadTimings().at(-1)).toMatchObject({ detail: '/settings' });
  expect(clock.getEntriesByName('webatrice:route-ready', 'mark')).toHaveLength(1);
  expect(clock.getEntriesByName('webatrice:route-ready', 'measure')).toHaveLength(1);
});

it('does not break app events when user timing is unavailable', () => {
  vi.stubGlobal('performance', {});
  expect(() => markLoadTiming('app-render')).not.toThrow();
});
