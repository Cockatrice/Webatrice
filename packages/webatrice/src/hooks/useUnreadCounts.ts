import { useSyncExternalStore } from 'react';
import { notificationStore, selectUnreadCounts, type UnreadCounts } from '@app/services';

export type { UnreadCounts };

export function useUnreadCounts(): UnreadCounts;
export function useUnreadCounts<T>(select: (counts: UnreadCounts) => T): T;
export function useUnreadCounts<T>(select?: (counts: UnreadCounts) => T): UnreadCounts | T {
  return useSyncExternalStore(notificationStore.subscribe, () => {
    const counts = selectUnreadCounts(notificationStore.getState());
    return select ? select(counts) : counts;
  });
}
