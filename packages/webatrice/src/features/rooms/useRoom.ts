import { useCallback, useEffect } from 'react';
import { useNavigate, useParams, generatePath } from 'react-router-dom';

import { useWebClient } from '@cockatrice/datatrice/react';
import { rooms } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import type { Message, Room } from '@cockatrice/datatrice';
import { RouteEnum } from '@app/types';

export interface UseRoomResult {
  roomId: number;
  room: Room | undefined;
  roomMessages: Message[] | undefined;
  users: ServerInfo_User[];
  handleRoomSay: (args: { message: string }) => void;
}

export function useRoom(): UseRoomResult {
  const joined = useAppSelector((state) => rooms.Selectors.getJoinedRooms(state));
  const allRooms = useAppSelector((state) => rooms.Selectors.getRooms(state));
  const messages = useAppSelector((state) => rooms.Selectors.getMessages(state));
  const navigate = useNavigate();
  const params = useParams();

  const parsed = params.roomId != null ? parseInt(params.roomId, 10) : NaN;
  const roomId = Number.isNaN(parsed) ? -1 : parsed;
  const room = roomId === -1 ? undefined : allRooms[roomId];
  const roomMessages = roomId === -1 ? undefined : messages[roomId];
  const users = useAppSelector((state) => rooms.Selectors.getSortedRoomUsers(state, roomId));
  const webClient = useWebClient();

  useEffect(() => {
    if (roomId === -1 || !joined.find((r) => r.info.roomId === roomId)) {
      navigate(generatePath(RouteEnum.SERVER));
    }
  }, [joined, roomId, navigate]);

  const handleRoomSay = useCallback(({ message }: { message: string }) => {
    if (message) {
      webClient.request.rooms.roomSay(roomId, message);
    }
  }, [webClient, roomId]);

  return { roomId, room, roomMessages, users, handleRoomSay };
}
