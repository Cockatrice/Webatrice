import { useEffect, type RefObject } from 'react';

const outside = (drawer: HTMLElement, target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && target !== document.body && !drawer.contains(target);

export function useDrawerReturnFocus(drawerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) {
      return;
    }
    let returnTo: HTMLElement | null = outside(drawer, document.activeElement) ? document.activeElement : null;
    const onFocusIn = (event: FocusEvent) => {
      if (outside(drawer, event.target)) {
        returnTo = event.target;
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      const active = document.activeElement;
      const focusLost = !active || active === document.body || drawer.contains(active);
      if (focusLost && returnTo?.isConnected) {
        returnTo.focus();
      }
    };
  }, [drawerRef]);
}
