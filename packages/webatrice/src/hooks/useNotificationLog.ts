import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { notificationStore, type NotificationState } from '@app/services';

export function useNotificationLog(): NotificationState {
  return useSyncExternalStore(notificationStore.subscribe, notificationStore.getState);
}

export function useNotificationDrawer(): { open: boolean; setOpen: (open: boolean) => void } {
  const open = useSyncExternalStore(notificationStore.subscribe, () => notificationStore.getState().drawerOpen);
  const setOpen = useCallback((next: boolean) => notificationStore.dispatch({ type: 'setDrawer', open: next }), []);
  return useMemo(() => ({ open, setOpen }), [open, setOpen]);
}
