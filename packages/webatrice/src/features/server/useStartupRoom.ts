import { useEffect, useRef } from 'react';
import { generatePath, useLocation, useNavigate } from 'react-router-dom';

import { rooms, server, type JoinRoomFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useReduxEffect } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { RouteEnum, type ServerRouteState } from '@app/types';

export const STARTUP_ROOM_TIMEOUT_MS = 20_000;

export function useStartupRoom(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const webClient = useWebClient();
  const roomName = (location.state as ServerRouteState | null)?.startupRoom;
  const roomsById = useAppSelector(rooms.Selectors.getRooms);
  const joinedRoomIds = useAppSelector(rooms.Selectors.getJoinedRoomIds);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const requestedRoomId = useRef<number | null>(null);

  useEffect(() => {
    if (!roomName) {
      requestedRoomId.current = null;
      return;
    }
    if (!isConnected) {
      requestedRoomId.current = null;
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    const roomList = Object.values(roomsById);
    if (!roomList.length) {
      return;
    }
    const room = roomList.find(({ info }) => info.name === roomName);
    if (!room) {
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    const { roomId, autoJoin } = room.info;
    if (joinedRoomIds[roomId]) {
      navigate(generatePath(RouteEnum.ROOM, { roomId: String(roomId) }), { replace: true });
      return;
    }
    if (requestedRoomId.current === null) {
      requestedRoomId.current = roomId;
      if (!autoJoin) {
        webClient.request.session.joinRoom(roomId);
      }
    }
  }, [roomName, roomsById, joinedRoomIds, isConnected, navigate, location.pathname, webClient]);

  useEffect(() => {
    if (!roomName) {
      return;
    }
    const giveUp = window.setTimeout(() => {
      if (requestedRoomId.current === null) {
        navigate(location.pathname, { replace: true, state: null });
      }
    }, STARTUP_ROOM_TIMEOUT_MS);
    return () => window.clearTimeout(giveUp);
  }, [roomName, navigate, location.pathname]);

  useReduxEffect<JoinRoomFailedPayload>((action) => {
    if (action.payload.roomId === requestedRoomId.current) {
      requestedRoomId.current = null;
      navigate(location.pathname, { replace: true, state: null });
    }
  }, rooms.Types.JOIN_ROOM_FAILED, [location.pathname]);
}
