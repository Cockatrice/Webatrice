import { useCallback, useEffect, useRef, useState } from 'react';

export function useElementWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) {
      return;
    }
    setWidth(Math.round(node.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    observer.current.observe(node);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, width];
}
