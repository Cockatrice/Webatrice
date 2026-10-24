import { useCallback } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';

import { useOpenChat } from '@app/hooks';
import { notificationStore, type NotificationTarget } from '@app/services';
import { RouteEnum } from '@app/types';

export function targetPath(target: NotificationTarget): string {
  switch (target.type) {
    case 'chat':
      return generatePath(RouteEnum.PLAYER, { name: target.userName });
    case 'room':
      return generatePath(RouteEnum.ROOM, { roomId: String(target.roomId) });
    case 'game':
      return generatePath(RouteEnum.GAME, { gameId: String(target.gameId) });
    default:
      return target.path;
  }
}

export function useOpenNotification(): (entry: { id?: number; target: NotificationTarget }) => void {
  const navigate = useNavigate();
  const openChat = useOpenChat();
  return useCallback(({ id, target }) => {
    if (id != null) {
      notificationStore.dispatch({ type: 'markEntryRead', id });
    }
    notificationStore.dispatch({ type: 'setDrawer', open: false });
    if (target.type === 'chat') {
      openChat(target.userName);
      return;
    }
    navigate(targetPath(target));
  }, [navigate, openChat]);
}
