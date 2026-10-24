import { act, fireEvent, renderHook } from '@testing-library/react';

import { useMarquee, type MarqueeRect } from './useMarquee';

function setup(select = vi.fn((_rect: MarqueeRect, _start: string) => 2), options = {}) {
  const hook = renderHook(() => useMarquee(select, options));
  return { ...hook, select };
}

describe('useMarquee', () => {
  it('follows the pointer from the press, selecting live, and ends on release', () => {
    const { result, select } = setup();
    act(() => result.current.begin({ clientX: 100, clientY: 50 }, 'hand'));
    expect(result.current.marquee).toEqual({ x1: 100, y1: 50, x2: 100, y2: 50, start: 'hand', count: 0 });

    act(() => {
      fireEvent.pointerMove(window, { clientX: 40, clientY: 80 });
    });
    expect(select).toHaveBeenLastCalledWith({ left: 40, right: 100, top: 50, bottom: 80 }, 'hand');
    expect(result.current.marquee).toMatchObject({ x2: 40, y2: 80, count: 2 });

    act(() => {
      fireEvent.pointerUp(window);
    });
    expect(result.current.marquee).toBeNull();
    fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('blocks text selection while the band is out, when asked', () => {
    const { result } = setup(undefined, { blockTextSelection: true });
    act(() => result.current.begin({ clientX: 0, clientY: 0 }, 'x'));
    expect(document.body.style.userSelect).toBe('none');
    act(() => {
      fireEvent.pointerUp(window);
    });
    expect(document.body.style.userSelect).toBe('');
  });

  it('leaves text selection alone by default', () => {
    const { result } = setup();
    act(() => result.current.begin({ clientX: 0, clientY: 0 }, 'x'));
    expect(document.body.style.userSelect).toBe('');
  });
});
