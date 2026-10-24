import { useCallback, useEffect, useRef, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';

import { games, rooms, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { Event_GameJoined } from '@cockatrice/sockatrice/generated';
import type { RoomCommandFailedPayload } from '@cockatrice/datatrice';
import { useReduxEffect } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

interface PendingJoin {
  gameId: number;
  roomId: number;
}

export function useJoinReportGame(): (gameId: number, roomId: number) => void {
  const webClient = useWebClient();
  const navigate = useNavigate();
  const joinedRoomIds = useAppSelector(rooms.Selectors.getJoinedRoomIds);
  const activeGameIds = useAppSelector(games.Selectors.getActiveGameIds);
  const isJudge = useAppSelector(server.Selectors.getIsUserJudge);
  const [pending, setPending] = useState<PendingJoin | null>(null);
  const requestedGameId = useRef<number | null>(null);

  const sendJoin = useCallback((gameId: number, roomId: number) => {
    requestedGameId.current = gameId;
    webClient.request.rooms.joinGame(roomId, {
      gameId,
      password: '',
      spectator: true,
      overrideRestrictions: isJudge,
      joinAsJudge: false,
    });
  }, [webClient, isJudge]);

  useEffect(() => {
    if (pending && joinedRoomIds[pending.roomId]) {
      setPending(null);
      sendJoin(pending.gameId, pending.roomId);
    }
  }, [pending, joinedRoomIds, sendJoin]);

  useReduxEffect<RoomCommandFailedPayload>((action) => {
    setPending((current) => (current?.roomId === action.payload.roomId ? null : current));
  }, rooms.Types.JOIN_ROOM_FAILED, []);

  useReduxEffect<{ data: Event_GameJoined }>((action) => {
    const gameId = action.payload.data.gameInfo?.gameId;
    if (gameId != null && gameId === requestedGameId.current) {
      requestedGameId.current = null;
      navigate(generatePath(RouteEnum.GAME, { gameId: gameId.toString() }));
    }
  }, games.Types.GAME_JOINED, [navigate]);

  return useCallback((gameId: number, roomId: number) => {
    if (activeGameIds.includes(gameId)) {
      navigate(generatePath(RouteEnum.GAME, { gameId: gameId.toString() }));
      return;
    }
    if (joinedRoomIds[roomId]) {
      sendJoin(gameId, roomId);
      return;
    }
    setPending({ gameId, roomId });
    webClient.request.session.joinRoom(roomId);
  }, [activeGameIds, joinedRoomIds, navigate, sendJoin, webClient]);
}
