import { useCallback, useEffect, useState } from 'react';

export interface ScrollFades {
  start: boolean;
  end: boolean;
}

const NONE: ScrollFades = { start: false, end: false };

export function scrollFades({ scrollLeft, clientWidth, scrollWidth }: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): ScrollFades {
  return {
    start: scrollLeft > 1,
    end: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

export function useScrollFades<T extends HTMLElement>(): { ref: (element: T | null) => void; fades: ScrollFades } {
  const [element, setElement] = useState<T | null>(null);
  const [fades, setFades] = useState<ScrollFades>(NONE);

  useEffect(() => {
    if (!element) {
      return;
    }
    const update = () => {
      const next = scrollFades(element);
      setFades((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resize?.observe(element);
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(update);
    mutations?.observe(element, { childList: true, subtree: true });
    return () => {
      element.removeEventListener('scroll', update);
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, [element]);

  const ref = useCallback((next: T | null) => setElement(next), []);
  return { ref, fades };
}
