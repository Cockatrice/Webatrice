import { useCallback, useEffect } from 'react';
import { useNavigate, useParams, generatePath } from 'react-router-dom';

import { useWebClient } from '@cockatrice/datatrice/react';
import { rooms } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import type { CreateGameParams } from '@cockatrice/sockatrice/generated';
import type { Message, Room } from '@cockatrice/datatrice';
import { RouteEnum } from '@app/types';

export interface UseRoomResult {
  roomId: number;
  room: Room | undefined;
  roomMessages: Message[] | undefined;
  handleRoomSay: (args: { message: string }) => void;
  handleCreateGame: (params: CreateGameParams) => void;
}

export function useRoom(): UseRoomResult {
  const navigate = useNavigate();
  const params = useParams();

  const parsed = params.roomId != null ? parseInt(params.roomId, 10) : NaN;
  const roomId = Number.isNaN(parsed) ? -1 : parsed;
  const room = useAppSelector((state) => roomId === -1 ? undefined : rooms.Selectors.getRoom(state, roomId));
  const roomMessages = useAppSelector((state) => roomId === -1 ? undefined : rooms.Selectors.getRoomMessages(state, roomId));
  const joined = useAppSelector((state) => Boolean(
    rooms.Selectors.getRoom(state, roomId) && rooms.Selectors.getJoinedRoomIds(state)[roomId],
  ));
  const webClient = useWebClient();

  useEffect(() => {
    if (roomId === -1 || !joined) {
      navigate(generatePath(RouteEnum.SERVER));
    }
  }, [joined, roomId, navigate]);

  const handleRoomSay = useCallback(({ message }: { message: string }) => {
    if (message) {
      webClient.request.rooms.roomSay(roomId, message);
    }
  }, [webClient, roomId]);

  const handleCreateGame = useCallback((params: CreateGameParams) => {
    webClient.request.rooms.createGame(roomId, params);
  }, [webClient, roomId]);

  return { roomId, room, roomMessages, handleRoomSay, handleCreateGame };
}
