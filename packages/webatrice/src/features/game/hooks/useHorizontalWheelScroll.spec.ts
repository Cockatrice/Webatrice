import { renderHook } from '@testing-library/react';

import { useHorizontalWheelScroll } from './useHorizontalWheelScroll';

function scroller(scrollWidth: number, clientWidth: number, scrollHeight = 0, clientHeight = 0): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight });
  return el;
}

function wheel(el: HTMLElement, deltaY: number): WheelEvent {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('useHorizontalWheelScroll', () => {
  it('scrolls sideways by the vertical delta and keeps the page from scrolling', () => {
    const el = scroller(1000, 300);
    renderHook(() => useHorizontalWheelScroll({ current: el }));

    const event = wheel(el, 40);

    expect(el.scrollLeft).toBe(40);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the wheel alone when nothing overflows or there is no vertical delta', () => {
    const narrow = scroller(300, 300);
    renderHook(() => useHorizontalWheelScroll({ current: narrow }));
    expect(wheel(narrow, 40).defaultPrevented).toBe(false);

    const wide = scroller(1000, 300);
    renderHook(() => useHorizontalWheelScroll({ current: wide }));
    expect(wheel(wide, 0).defaultPrevented).toBe(false);
    expect(wide.scrollLeft).toBe(0);
  });

  it('keeps the native vertical scroll when the content also overflows vertically', () => {
    const el = scroller(1000, 300, 500, 200);
    renderHook(() => useHorizontalWheelScroll({ current: el }));
    expect(wheel(el, 40).defaultPrevented).toBe(false);
    expect(el.scrollLeft).toBe(0);
  });

  it('registers a non-passive listener and removes it on unmount', () => {
    const el = scroller(1000, 300);
    const add = vi.spyOn(el, 'addEventListener');
    const remove = vi.spyOn(el, 'removeEventListener');
    const { unmount } = renderHook(() => useHorizontalWheelScroll({ current: el }));
    expect(add).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    unmount();
    expect(remove).toHaveBeenCalledWith('wheel', add.mock.calls[0][1]);
  });
});
