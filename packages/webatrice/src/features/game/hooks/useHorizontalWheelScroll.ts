import { useEffect, type RefObject } from 'react';

export function useHorizontalWheelScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || el.scrollHeight > el.clientHeight) {
        return;
      }
      if (e.deltaY === 0) {
        return;
      }
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [ref]);
}
