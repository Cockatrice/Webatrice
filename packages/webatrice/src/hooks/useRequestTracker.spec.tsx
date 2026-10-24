import { StrictMode, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { endSession } from '@app/services/session';
import { useRequestTracker } from './useRequestTracker';

it('owns only the latest request and returns a stable API across renders', () => {
  const { result, rerender } = renderHook(useRequestTracker);
  const tracker = result.current;
  expect(tracker.isCurrent(undefined)).toBe(false);
  const first = tracker.begin();
  const second = tracker.begin();
  expect(first).not.toBe(second);
  expect(tracker.isCurrent(first)).toBe(false);
  expect(tracker.isCurrent(second)).toBe(true);
  rerender();
  expect(result.current).toBe(tracker);
  tracker.cancel();
  expect(tracker.isCurrent(second)).toBe(false);
});

it('settles each parallel request once without changing the latest request', () => {
  const { result } = renderHook(useRequestTracker);
  const tracker = result.current;
  const latest = tracker.begin();
  tracker.track('a');
  tracker.track('b');
  expect(tracker.settle(undefined)).toBe(false);
  expect(tracker.settle('unrelated')).toBe(false);
  expect(tracker.settle('b')).toBe(true);
  expect(tracker.settle('b')).toBe(false);
  expect(tracker.isCurrent(latest)).toBe(true);
  tracker.cancel();
  expect(tracker.settle('a')).toBe(false);
});

it('cancels on session end and unmount, including escaped callbacks', () => {
  const { result, unmount } = renderHook(useRequestTracker);
  const tracker = result.current;
  const first = tracker.begin();
  tracker.track('parallel');
  endSession();
  expect(tracker.isCurrent(first)).toBe(false);
  expect(tracker.settle('parallel')).toBe(false);
  const second = tracker.begin();
  expect(tracker.isCurrent(second)).toBe(true);
  unmount();
  expect(tracker.isCurrent(second)).toBe(false);
  expect(tracker.isCurrent(tracker.begin())).toBe(false);
  tracker.track('late');
  expect(tracker.settle('late')).toBe(false);
});

it('uses unique fallback identities across hook instances and survives StrictMode', () => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => undefined!);
  const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
  const a = renderHook(useRequestTracker, { wrapper });
  const b = renderHook(useRequestTracker, { wrapper });
  const first = a.result.current.begin();
  const second = b.result.current.begin();
  expect(first).not.toBe(second);
  expect(a.result.current.isCurrent(first)).toBe(true);
  expect(b.result.current.isCurrent(second)).toBe(true);
});
