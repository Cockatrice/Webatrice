import { isPageInactive, notificationStore, type UnreadScope } from '@app/services';

export interface MarkRead {
  markRoomRead(id: number): void;
  markGameRead(id: number): void;
  markChatRead(name: string): void;
  markNotificationsRead(): void;
}

const clearWhileActive = (scope: UnreadScope, key: number | string) => {
  if (!isPageInactive()) {
    notificationStore.dispatch({ type: 'clear', scope, key });
  }
};

const markRead: MarkRead = {
  markRoomRead: (id) => clearWhileActive('rooms', id),
  markGameRead: (id) => clearWhileActive('games', id),
  markChatRead: (name) => clearWhileActive('chats', name),
  markNotificationsRead: () => notificationStore.dispatch({ type: 'markAllRead' }),
};

export function useMarkRead(): MarkRead {
  return markRead;
}
