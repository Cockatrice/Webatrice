import { StrictMode } from 'react';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders, connectedState, disconnectedState } from './__test-utils__';
import RoutePrefetch, { useDeckEditorRoutePrefetch } from './RoutePrefetch';
import { prefetchRoutes } from './lazyRoutes';

const routeMocks = vi.hoisted(() => ({
  isLoaded: vi.fn(() => false),
  preload: vi.fn(() => Promise.resolve({ default: () => null })),
}));

vi.mock('./lazyRoutes', () => ({
  lazyRoutes: { DeckEditor: routeMocks },
  prefetchRoutes: vi.fn(),
}));

let frames: Map<number, FrameRequestCallback>;
let idleCallbacks: Map<number, IdleRequestCallback>;
let nextId: number;

beforeEach(() => {
  vi.useFakeTimers();
  routeMocks.isLoaded.mockReturnValue(false);
  routeMocks.preload.mockResolvedValue({ default: () => null });
  frames = new Map();
  idleCallbacks = new Map();
  nextId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    idleCallbacks.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelIdleCallback', (id: number) => idleCallbacks.delete(id));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function frame() {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach(callback => callback(0)));
}

function mount() {
  return renderWithProviders(<StrictMode><RoutePrefetch /></StrictMode>, { preloadedState: connectedState });
}

function DeckEditorPrefetchProbe() {
  const prefetch = useDeckEditorRoutePrefetch();
  return <button type="button" onPointerEnter={prefetch} onFocus={prefetch}>Open deck</button>;
}

it('waits for Home to paint and then for idle, including under StrictMode', () => {
  mount();
  expect(prefetchRoutes).not.toHaveBeenCalled();
  expect(idleCallbacks.size).toBe(0);
  frame();
  expect(idleCallbacks.size).toBe(0);
  frame();
  expect(idleCallbacks.size).toBe(1);
  expect(prefetchRoutes).not.toHaveBeenCalled();
  act(() => [...idleCallbacks.values()].forEach(callback => callback({ didTimeout: false, timeRemaining: () => 50 })));
  expect(prefetchRoutes).toHaveBeenCalledTimes(1);
});

it('uses a deferred timeout after paint when idle callbacks are unavailable', () => {
  vi.stubGlobal('requestIdleCallback', undefined);
  mount();
  act(() => vi.runAllTimers());
  expect(prefetchRoutes).not.toHaveBeenCalled();
  frame();
  frame();
  expect(prefetchRoutes).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1000));
  expect(prefetchRoutes).toHaveBeenCalledTimes(1);
});

it.each([0, 1, 2])('cancels scheduled prefetch when Home unmounts after %s frames', (count) => {
  const { unmount } = mount();
  for (let i = 0; i < count; i++) {
    frame();
  }
  unmount();
  expect(frames.size).toBe(0);
  expect(idleCallbacks.size).toBe(0);
  expect(prefetchRoutes).not.toHaveBeenCalled();
});

it('cancels the fallback timeout on unmount', () => {
  vi.stubGlobal('requestIdleCallback', undefined);
  const { unmount } = mount();
  frame();
  frame();
  unmount();
  act(() => vi.runAllTimers());
  expect(prefetchRoutes).not.toHaveBeenCalled();
});

it('does not prefetch while Home is redirecting a signed-out user', () => {
  renderWithProviders(<RoutePrefetch />, { preloadedState: disconnectedState });
  expect(frames.size).toBe(0);
  expect(prefetchRoutes).not.toHaveBeenCalled();
});

it('prefetches the deck editor on idle after the caller mounts', () => {
  renderWithProviders(<DeckEditorPrefetchProbe />);
  frame();
  frame();
  expect(routeMocks.preload).not.toHaveBeenCalled();
  act(() => [...idleCallbacks.values()].forEach(callback => callback({ didTimeout: false, timeRemaining: () => 50 })));
  expect(routeMocks.preload).toHaveBeenCalledTimes(1);
});

it('does not schedule idle work when the deck editor is loaded', () => {
  routeMocks.isLoaded.mockReturnValue(true);
  renderWithProviders(<DeckEditorPrefetchProbe />);
  expect(frames.size).toBe(0);
  expect(routeMocks.preload).not.toHaveBeenCalled();
});

it('deduplicates pointer and focus prefetches for the same mount', () => {
  renderWithProviders(<DeckEditorPrefetchProbe />);
  const button = screen.getByRole('button', { name: 'Open deck' });
  fireEvent.pointerEnter(button);
  fireEvent.focus(button);
  expect(routeMocks.preload).toHaveBeenCalledTimes(1);
});
