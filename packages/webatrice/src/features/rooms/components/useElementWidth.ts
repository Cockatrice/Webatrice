import { useCallback, useEffect, useState } from 'react';

export function useElementWidth<T extends HTMLElement>(): [(element: T | null) => void, number, T | null] {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(Number.POSITIVE_INFINITY);
  const ref = useCallback((node: T | null) => setElement(node), []);
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => setWidth(element.clientWidth || Number.POSITIVE_INFINITY));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, width, element];
}
