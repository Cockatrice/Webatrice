import { act, fireEvent, renderHook } from '@testing-library/react';
import type React from 'react';

import {
  clampPanelPosition,
  clampPanelSize,
  readStoredPosition,
  readStoredSize,
  useFloatingPanelGeometry,
  type FloatingPanelGeometryOptions,
  type PanelSize,
} from './useFloatingPanelGeometry';

const KEY = 'webatrice.testPanel';
const MIN = { w: 400, h: 300 };

afterEach(() => {
  window.localStorage.clear();
});

describe('clampPanelSize', () => {
  it('keeps a size between the minimum and the viewport, the viewport winning', () => {
    expect(clampPanelSize({ w: 600, h: 500 }, MIN)).toEqual({ w: 600, h: 500 });
    expect(clampPanelSize({ w: 100, h: 100 }, MIN)).toEqual({ w: 400, h: 300 });
    expect(clampPanelSize({ w: 5000, h: 5000 }, MIN)).toEqual({ w: window.innerWidth, h: window.innerHeight });
    expect(clampPanelSize({ w: 100, h: 100 }, { w: 5000, h: 5000 })).toEqual({ w: window.innerWidth, h: window.innerHeight });
  });
});

describe('clampPanelPosition', () => {
  it('keeps 60px of the header on screen', () => {
    const size = { w: 500, h: 400 };
    expect(clampPanelPosition({ x: 100, y: 100 }, size)).toEqual({ x: 100, y: 100 });
    expect(clampPanelPosition({ x: 5000, y: 5000 }, size)).toEqual({ x: window.innerWidth - 60, y: window.innerHeight - 60 });
    expect(clampPanelPosition({ x: -5000, y: -50 }, size)).toEqual({ x: 60 - 500, y: 0 });
  });
});

describe('stored geometry', () => {
  it('reads a finite point and size, and nothing malformed', () => {
    window.localStorage.setItem(`${KEY}Position`, JSON.stringify({ x: 1, y: 2, extra: true }));
    window.localStorage.setItem(`${KEY}Size`, JSON.stringify({ w: 3, h: 'tall' }));
    expect(readStoredPosition(KEY)).toEqual({ x: 1, y: 2 });
    expect(readStoredSize(KEY)).toBeNull();
    window.localStorage.setItem(`${KEY}Size`, '{not json');
    expect(readStoredSize(KEY)).toBeNull();
    expect(readStoredPosition('webatrice.nothing')).toBeNull();
  });
});

describe('useFloatingPanelGeometry', () => {
  function setup(options: Partial<FloatingPanelGeometryOptions> = {}, rect = new DOMRect(0, 0, 0, 0)) {
    const panel = document.createElement('div');
    panel.getBoundingClientRect = () => rect;
    return renderHook((props: Partial<FloatingPanelGeometryOptions>) => {
      const geometry = useFloatingPanelGeometry({ storageKey: KEY, minSize: MIN, initialSize: { w: 900, h: 480 }, ...props });
      geometry.panelRef.current = panel;
      return { ...geometry, panel };
    }, { initialProps: options });
  }

  it('opens at its initial size, centred', () => {
    const { result } = setup({}, new DOMRect(0, 0, 200, 100));
    expect(result.current.panel.style.width).toBe('900px');
    expect(result.current.panel.style.height).toBe('480px');
    expect(result.current.panelStyle).toMatchObject({
      position: 'absolute',
      left: (window.innerWidth - 200) / 2,
      top: (window.innerHeight - 100) / 2,
    });
    expect(result.current.panelStyle).toMatchObject({ minWidth: 'min(400px, 100vw)', minHeight: 'min(300px, 100vh)' });
  });

  it('lets the viewport win over its minimum, in its CSS too', () => {
    const { innerWidth, innerHeight } = window;
    window.innerWidth = 300;
    window.innerHeight = 200;
    try {
      window.localStorage.setItem(`${KEY}Size`, JSON.stringify({ w: 100, h: 100 }));
      const { result } = setup();
      expect(result.current.panel.style.width).toBe('300px');
      expect(result.current.panel.style.height).toBe('200px');
      expect(result.current.panelStyle).toMatchObject({ minWidth: 'min(400px, 100vw)', minHeight: 'min(300px, 100vh)' });
    } finally {
      window.innerWidth = innerWidth;
      window.innerHeight = innerHeight;
    }
  });

  const press = (target: Element, button = 0) =>
    ({ button, target, clientX: 110, clientY: 105 }) as unknown as React.PointerEvent<HTMLElement>;

  it('lets the caller size it when no size is stored', () => {
    const initialSize = vi.fn((el: HTMLDivElement) => {
      el.style.height = '123px';
    });
    const { result } = setup({ initialSize });
    expect(initialSize).toHaveBeenCalledWith(result.current.panel);
    expect(result.current.panel.style.height).toBe('123px');
  });

  it('opens at its stored size and position, clamped', () => {
    window.localStorage.setItem(`${KEY}Size`, JSON.stringify({ w: 5000, h: 100 }));
    window.localStorage.setItem(`${KEY}Position`, JSON.stringify({ x: 5000, y: 20 }));
    const { result } = setup();
    expect(result.current.panel.style.width).toBe(`${window.innerWidth}px`);
    expect(result.current.panel.style.height).toBe('300px');
    expect(result.current.panelStyle).toMatchObject({ left: window.innerWidth - 60, top: 20 });
  });

  it('moves by its header and stores where it was left', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup({}, new DOMRect(100, 100, 400, 300));
      const header = document.createElement('div');
      act(() => {
        result.current.onHeaderPointerDown(press(header));
      });
      expect(result.current.dragging).toBe(true);
      act(() => {
        fireEvent.pointerMove(window, { clientX: 310, clientY: 205 });
        fireEvent.pointerUp(window);
      });
      expect(result.current.dragging).toBe(false);
      expect(result.current.panelStyle).toMatchObject({ left: 300, top: 200 });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(readStoredPosition(KEY)).toEqual({ x: 300, y: 200 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts no move from a header button or another mouse button, and stores nothing on open', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup({}, new DOMRect(100, 100, 400, 300));
      const button = document.createElement('button');
      act(() => {
        result.current.onHeaderPointerDown(press(button));
        result.current.onHeaderPointerDown(press(document.body, 2));
      });
      expect(result.current.dragging).toBe(false);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(readStoredPosition(KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  describe('stored size', () => {
    let observe: (size: PanelSize) => void;
    let disconnect: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      disconnect = vi.fn();
      vi.stubGlobal('ResizeObserver', class {
        constructor(callback: ResizeObserverCallback) {
          observe = ({ w, h }) => callback(
            [{ contentRect: new DOMRect(0, 0, w, h) } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      });
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('does not store the size it opens at', () => {
      setup();
      act(() => {
        observe({ w: 900, h: 480 });
        vi.advanceTimersByTime(1000);
      });
      expect(readStoredSize(KEY)).toBeNull();
    });

    it('stores a resize half a second after the last one', () => {
      setup();
      act(() => {
        observe({ w: 900, h: 480 });
        observe({ w: 700, h: 400 });
        vi.advanceTimersByTime(400);
        observe({ w: 650, h: 380 });
        vi.advanceTimersByTime(499);
      });
      expect(readStoredSize(KEY)).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(readStoredSize(KEY)).toEqual({ w: 650, h: 380 });
    });

    it('drops a pending write when it closes', () => {
      const { unmount } = setup();
      act(() => {
        observe({ w: 900, h: 480 });
        observe({ w: 700, h: 400 });
      });
      unmount();
      expect(disconnect).toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(readStoredSize(KEY)).toBeNull();
    });
  });

  it('opens again when its open key changes', () => {
    const { result, rerender } = setup({ openKey: 1 });
    result.current.panel.style.width = '10px';
    rerender({ openKey: 1 });
    expect(result.current.panel.style.width).toBe('10px');
    rerender({ openKey: 2 });
    expect(result.current.panel.style.width).toBe('900px');
  });

  describe('opening again', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function drag(result: ReturnType<typeof setup>['result']) {
      act(() => {
        result.current.onHeaderPointerDown(press(document.createElement('div')));
      });
      act(() => {
        fireEvent.pointerMove(window, { clientX: 310, clientY: 205 });
        fireEvent.pointerUp(window);
      });
      expect(result.current.panelStyle).toMatchObject({ left: 300, top: 200 });
    }

    it('centres itself again and forgets the drag, storing nothing', () => {
      const { result, rerender } = setup({ openKey: 1 }, new DOMRect(100, 100, 400, 300));
      drag(result);
      rerender({ openKey: 2 });
      expect(result.current.panelStyle).toMatchObject({
        left: (window.innerWidth - 400) / 2,
        top: (window.innerHeight - 300) / 2,
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(readStoredPosition(KEY)).toBeNull();
    });

    it('goes back to its stored position, clamped', () => {
      const { result, rerender } = setup({ openKey: 1 }, new DOMRect(100, 100, 400, 300));
      drag(result);
      window.localStorage.setItem(`${KEY}Position`, JSON.stringify({ x: 5000, y: 20 }));
      rerender({ openKey: 2 });
      expect(result.current.panelStyle).toMatchObject({ left: window.innerWidth - 60, top: 20 });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(readStoredPosition(KEY)).toEqual({ x: 5000, y: 20 });
    });
  });
});
