import { useEffect, useMemo, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

import { rooms, server } from '@cockatrice/datatrice';
import { loadPersistedLastRoomId, persistLastRoomId } from '@app/services';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

import { playPath } from '../navPlaces';

export function usePlayPath(): string {
  const { pathname } = useLocation();
  const joinedRooms = useAppSelector(rooms.Selectors.getJoinedRooms);
  const serverName = useAppSelector(server.Selectors.getName);
  const userName = useAppSelector(server.Selectors.getUser)?.name;
  const owner = serverName && userName ? `${serverName}::${userName}` : null;
  const stored = useMemo(() => (owner ? loadPersistedLastRoomId(owner) : null), [owner]);
  const [visited, setVisited] = useState<{ owner: string; roomId: number } | null>(null);

  useEffect(() => {
    const roomId = Number(matchPath(RouteEnum.ROOM, pathname)?.params.roomId);
    if (owner && Number.isInteger(roomId) && roomId >= 0) {
      persistLastRoomId(owner, roomId);
      setVisited({ owner, roomId });
    }
  }, [pathname, owner]);

  const lastRoomId = owner && visited?.owner === owner ? visited.roomId : stored;
  return playPath(lastRoomId, joinedRooms);
}
