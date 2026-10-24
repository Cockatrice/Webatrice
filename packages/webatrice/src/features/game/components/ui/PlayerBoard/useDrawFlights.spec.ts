import { act, renderHook } from '@testing-library/react';

import { DRAW_ANIMATION_MS, useDrawFlights } from './useDrawFlights';

function elementAt(rect: DOMRect): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => rect;
  return el;
}

const LIBRARY = new DOMRect(0, 0, 100, 70);
const HAND = new DOMRect(300, 400, 200, 100);

function renderFlights(handRect = HAND, enabled = true) {
  const libraryRef = { current: elementAt(LIBRARY) };
  const handRef = { current: elementAt(handRect) };
  return renderHook(
    ({ drawSeq, lastDrawCount, animationsEnabled }) =>
      useDrawFlights({
        drawSeq,
        lastDrawCount,
        libraryRef,
        handRef,
        enabled: animationsEnabled,
      }),
    { initialProps: { drawSeq: 3, lastDrawCount: 1, animationsEnabled: enabled } },
  );
}

let nextFrameId = 1;
let pendingFrames = new Map<number, FrameRequestCallback>();

function runNextFrame() {
  const next = pendingFrames.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (!next) {
    throw new Error('Expected a pending animation frame');
  }
  const [id, callback] = next;
  pendingFrames.delete(id);
  act(() => callback(0));
}

beforeEach(() => {
  vi.useFakeTimers();
  nextFrameId = 1;
  pendingFrames = new Map();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = nextFrameId++;
    pendingFrames.set(id, cb);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    pendingFrames.delete(id);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDrawFlights', () => {
  it('takes the first beacon as the baseline and flies nothing', () => {
    const { result } = renderFlights();
    act(() => vi.runAllTimers());
    expect(result.current.flights).toEqual([]);
  });

  it('flies one card back per drawn card, staggered, landing on the hand and then clearing', () => {
    const { result, rerender } = renderFlights();
    rerender({ drawSeq: 4, lastDrawCount: 2, animationsEnabled: true });

    act(() => vi.advanceTimersByTime(0));
    expect(result.current.flights).toEqual([{ id: 1, from: LIBRARY, to: HAND, landed: false }]);
    runNextFrame();
    runNextFrame();
    expect(result.current.flights).toEqual([{ id: 1, from: LIBRARY, to: HAND, landed: true }]);
    act(() => vi.advanceTimersByTime(90));
    expect(result.current.flights.map((f) => f.id)).toEqual([1, 2]);

    act(() => vi.advanceTimersByTime(DRAW_ANIMATION_MS + 50));
    expect(result.current.flights).toEqual([]);
  });

  it('flies nothing while the board animation policy is off', () => {
    const { result, rerender } = renderFlights(HAND, false);
    rerender({ drawSeq: 4, lastDrawCount: 2, animationsEnabled: false });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.flights).toEqual([]);
    act(() => vi.advanceTimersByTime(90));
    expect(result.current.flights).toEqual([]);
  });

  it('cancels active and staggered flights when the board animation policy turns off', () => {
    const { result, rerender } = renderFlights();
    rerender({ drawSeq: 4, lastDrawCount: 2, animationsEnabled: true });

    act(() => vi.advanceTimersByTime(0));
    expect(result.current.flights.map((flight) => flight.id)).toEqual([1]);

    rerender({ drawSeq: 4, lastDrawCount: 2, animationsEnabled: false });
    expect(result.current.flights).toEqual([]);

    act(() => vi.advanceTimersByTime(90));
    expect(result.current.flights).toEqual([]);
  });

  it('cancels a scheduled landing frame when the policy turns off', () => {
    const { result, rerender } = renderFlights();
    rerender({ drawSeq: 4, lastDrawCount: 1, animationsEnabled: true });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.flights).toHaveLength(1);
    expect(pendingFrames).toHaveLength(1);

    rerender({ drawSeq: 4, lastDrawCount: 1, animationsEnabled: false });

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(pendingFrames).toHaveLength(0);
    expect(result.current.flights).toEqual([]);
  });

  it('cancels pending timers and frames on unmount', () => {
    const { rerender, unmount } = renderFlights();
    rerender({ drawSeq: 4, lastDrawCount: 2, animationsEnabled: true });
    act(() => vi.advanceTimersByTime(0));
    expect(pendingFrames).toHaveLength(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(pendingFrames).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a beacon that did not tick and a draw with no zone to measure', () => {
    const { result, rerender } = renderFlights(new DOMRect(0, 0, 0, 0));
    rerender({ drawSeq: 3, lastDrawCount: 5, animationsEnabled: true });
    rerender({ drawSeq: 4, lastDrawCount: 1, animationsEnabled: true });
    act(() => vi.runAllTimers());
    expect(result.current.flights).toEqual([]);
  });
});
