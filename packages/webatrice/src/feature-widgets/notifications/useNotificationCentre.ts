import { useEffect, useRef, useState, type RefObject } from 'react';

import { useNotificationDrawer } from '@app/hooks';
import { getNotificationPermission, watchNotificationPermission, type NotificationPermissionState } from '@app/services';

export const BELL_ATTRIBUTE = 'data-notification-bell';
const TICK = 30_000;

export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), TICK);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export function useNotificationPermission(): NotificationPermissionState {
  const [permission, setPermission] = useState(getNotificationPermission);
  useEffect(() => watchNotificationPermission(setPermission), []);
  return permission;
}

export function useDrawerFocus(panel: RefObject<HTMLElement | null>): { open: boolean; close: () => void } {
  const { open, setOpen } = useNotificationDrawer();
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (panel.current?.contains(target) || target?.closest?.(`[${BELL_ATTRIBUTE}]`)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      const back = returnFocus.current;
      if (back?.isConnected && (!document.activeElement || document.activeElement === document.body)) {
        back.focus();
      }
    };
  }, [open, setOpen, panel]);

  return { open, close: () => setOpen(false) };
}
