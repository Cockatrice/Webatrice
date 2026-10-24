import { useSyncExternalStore } from 'react';
import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { useReduxEffect } from './useReduxEffect';

let locked = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return locked;
}

export function setAdminLocked(next: boolean): void {
  if (next === locked) {
    return;
  }
  locked = next;
  listeners.forEach((cb) => cb());
}

export function useAdminLocked(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAdminLock(): [boolean, (next: boolean) => void] {
  return [useAdminLocked(), setAdminLocked];
}

export function useAdminLockSession(): void {
  useReduxEffect<{ status?: { state: WebsocketTypes.StatusEnum } }>(({ type, payload }) => {
    if (type === server.Types.CLEAR_STORE || payload.status?.state === WebsocketTypes.StatusEnum.DISCONNECTED) {
      setAdminLocked(false);
    }
  }, [server.Types.CLEAR_STORE, server.Types.UPDATE_STATUS]);
}
