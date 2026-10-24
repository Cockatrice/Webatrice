import { act, render, renderHook, screen } from '@testing-library/react';

import { CardPreviewProvider, createCardPreviewStore, type HoverZoom } from '../CardPreviewContext';
import { HoverCardZoom } from './HoverCardZoom';
import { FINE_POINTER_QUERY, HOVER_ZOOM_DELAY_MS, HOVER_ZOOM_GRACE_MS, useHoverZoomTarget } from './useFloatingPreview';

const anchor = { left: 200, top: 300, right: 272, bottom: 402 };
const BOLT: HoverZoom = { card: { name: 'Lightning Bolt', scryfallId: 'bolt-id' }, anchor };
const OGRE: HoverZoom = { card: { name: 'Gray Ogre' }, anchor: { ...anchor, left: 300, right: 372 } };

function mockPointer(fine: boolean) {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: query === FINE_POINTER_QUERY ? fine : false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
  return () => {
    if (original) {
      Object.defineProperty(window, 'matchMedia', original);
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  };
}

describe('useHoverZoomTarget', () => {
  let restore: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    restore = mockPointer(true);
  });

  afterEach(() => {
    restore();
    vi.useRealTimers();
  });

  const renderTarget = (initial: HoverZoom | null) =>
    renderHook(({ zoom }: { zoom: HoverZoom | null }) => useHoverZoomTarget(zoom), { initialProps: { zoom: initial } });

  it('waits for the pointer to rest on a card before zooming', () => {
    const { result } = renderTarget(BOLT);
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS - 1));
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(BOLT);
  });

  it('follows the pointer straight to the next card once a zoom is showing', () => {
    const { result, rerender } = renderTarget(BOLT);
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS));
    rerender({ zoom: null });
    expect(result.current).toBeNull();
    rerender({ zoom: OGRE });
    expect(result.current).toBe(OGRE);
  });

  it('waits again after the pointer has been off the cards for a while', () => {
    const { result, rerender } = renderTarget(BOLT);
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS));
    rerender({ zoom: null });
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_GRACE_MS + 1));
    rerender({ zoom: OGRE });
    expect(result.current).toBeNull();
  });

  it('hides on a click or drag and stays hidden for that card', () => {
    const { result, rerender } = renderTarget(BOLT);
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS));
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(result.current).toBeNull();
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
      vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS * 2);
    });
    expect(result.current).toBeNull();
    rerender({ zoom: OGRE });
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS));
    expect(result.current).toBe(OGRE);
  });

  it('never zooms on touch screens', () => {
    restore();
    restore = mockPointer(false);
    const { result } = renderTarget(BOLT);
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS * 2));
    expect(result.current).toBeNull();
  });
});

describe('HoverCardZoom', () => {
  let restore: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    restore = mockPointer(true);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    restore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows the hovered card large beside it and hides when the pointer leaves', () => {
    const store = createCardPreviewStore();
    render(
      <CardPreviewProvider store={store}>
        <HoverCardZoom />
      </CardPreviewProvider>,
    );
    act(() => store.setHoveredCard(BOLT.card, anchor));
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS));

    const zoom = screen.getByTestId('hover-card-zoom');
    expect(parseFloat(zoom.style.left)).toBeGreaterThanOrEqual(anchor.right);
    expect(parseFloat(zoom.style.width)).toBeGreaterThanOrEqual(300);
    expect(zoom.querySelector('img')?.getAttribute('src')).toContain('bolt-id');

    act(() => store.endHover());
    expect(screen.queryByTestId('hover-card-zoom')).not.toBeInTheDocument();
    expect(store.getPreviewCard()).toBe(BOLT.card);
  });

  it('does not zoom cards hovered without a position, such as chat links', () => {
    const store = createCardPreviewStore();
    render(
      <CardPreviewProvider store={store}>
        <HoverCardZoom />
      </CardPreviewProvider>,
    );
    act(() => store.setHoveredCard(BOLT.card));
    act(() => vi.advanceTimersByTime(HOVER_ZOOM_DELAY_MS * 2));
    expect(screen.queryByTestId('hover-card-zoom')).not.toBeInTheDocument();
  });
});
