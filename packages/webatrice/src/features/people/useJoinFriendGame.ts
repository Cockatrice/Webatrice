import { useCallback, useEffect, useState } from 'react';

import { games, rooms } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_Game } from '@cockatrice/sockatrice/generated';
import { useJoinGame, useNavigateOnGameJoined, type JoinGameFlow } from '@app/hooks';
import { useAppSelector } from '@app/store';

export const ROOM_JOIN_WAIT_MS = 15_000;

interface PendingRoomJoin {
  game: ServerInfo_Game;
  spectate: boolean;
}

export interface JoinFriendGame extends JoinGameFlow {
  join: (game: ServerInfo_Game) => void;
  watch: (game: ServerInfo_Game) => void;
  waitingForRoom: boolean;
  roomTimedOut: boolean;
  dismissRoomTimeout: () => void;
}

export function useJoinFriendGame(): JoinFriendGame {
  const webClient = useWebClient();
  const flow = useJoinGame();
  const { beginJoin } = flow;
  const joinedRoomIds = useAppSelector(rooms.Selectors.getJoinedRoomIds);
  const activeGameIds = useAppSelector(games.Selectors.getActiveGameIds);
  const [pending, setPending] = useState<PendingRoomJoin | null>(null);
  const [roomTimedOut, setRoomTimedOut] = useState(false);
  useNavigateOnGameJoined();

  const start = useCallback(
    (game: ServerInfo_Game, spectate: boolean) => {
      setRoomTimedOut(false);
      if (activeGameIds.includes(game.gameId) || joinedRoomIds[game.roomId]) {
        setPending(null);
        beginJoin(game.roomId, game, spectate, false);
        return;
      }
      setPending({ game, spectate });
      webClient.request.session.joinRoom(game.roomId);
    },
    [activeGameIds, beginJoin, joinedRoomIds, webClient],
  );

  useEffect(() => {
    if (!pending) {
      return;
    }
    if (joinedRoomIds[pending.game.roomId]) {
      setPending(null);
      beginJoin(pending.game.roomId, pending.game, pending.spectate, false);
      return;
    }
    const timer = setTimeout(() => {
      setPending(null);
      setRoomTimedOut(true);
    }, ROOM_JOIN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [pending, joinedRoomIds, beginJoin]);

  return {
    ...flow,
    join: useCallback((game: ServerInfo_Game) => start(game, false), [start]),
    watch: useCallback((game: ServerInfo_Game) => start(game, true), [start]),
    waitingForRoom: pending !== null,
    roomTimedOut,
    dismissRoomTimeout: useCallback(() => setRoomTimedOut(false), []),
  };
}
