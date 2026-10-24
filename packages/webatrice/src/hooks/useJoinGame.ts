import { useCallback, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';

import { games, rooms, type JoinGameError } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { Event_GameJoined, ServerInfo_Game } from '@cockatrice/sockatrice/generated';
import { useAppDispatch, useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

import { useCanOverrideGameRestrictions } from './useCanOverrideGameRestrictions';
import { useReduxEffect } from './useReduxEffect';
import { useRequestTracker } from './useRequestTracker';

interface PendingJoin {
  roomId: number;
  gameId: number;
  description: string;
  asSpectator: boolean;
  asJudge: boolean;
}

export interface JoinGameFlow {
  beginJoin: (roomId: number, game: ServerInfo_Game, asSpectator: boolean, asJudge: boolean) => void;
  passwordRequired: boolean;
  passwordGame: Pick<ServerInfo_Game, 'gameId' | 'description'> | null;
  submitPassword: (password: string) => void;
  cancelPassword: () => void;
  spectatorConfirmationRequired: boolean;
  confirmSpectatorJoin: () => void;
  cancelSpectatorJoin: () => void;
  joinPending: boolean;
  joinError: JoinGameError | null;
  clearJoinError: () => void;
}

export function useJoinGame(onAlreadyOpen?: () => void): JoinGameFlow {
  const webClient = useWebClient();
  const overrideRestrictions = useCanOverrideGameRestrictions();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const activeGameIds = useAppSelector(games.Selectors.getActiveGameIds);
  const joinPending = useAppSelector(rooms.Selectors.getJoinGamePending);
  const storedJoinError = useAppSelector(rooms.Selectors.getJoinGameError);
  const [pendingPasswordJoin, setPendingPasswordJoin] = useState<PendingJoin | null>(null);
  const [pendingSpectatorJoin, setPendingSpectatorJoin] = useState<{ join: PendingJoin; needsPassword: boolean } | null>(null);
  const request = useRequestTracker();
  const [joinError, setJoinError] = useState<JoinGameError | null>(null);

  useReduxEffect<JoinGameError>((action) => {
    if (request.isCurrent(action.payload.requestId)) {
      setJoinError(action.payload);
      request.cancel();
    }
  }, rooms.Types.SET_JOIN_GAME_ERROR, [request]);

  const sendJoin = useCallback(
    ({ roomId, gameId, asSpectator, asJudge }: PendingJoin, password: string) => {
      if (activeGameIds.includes(gameId)) {
        navigate(generatePath(RouteEnum.GAME, { gameId: gameId.toString() }));
        onAlreadyOpen?.();
        return;
      }
      setJoinError(null);
      const requestId = request.begin();
      webClient.request.rooms.joinGame(roomId, {
        gameId,
        password,
        spectator: asSpectator,
        overrideRestrictions,
        joinAsJudge: asJudge,
      }, requestId);
    },
    [activeGameIds, navigate, onAlreadyOpen, overrideRestrictions, request, webClient],
  );

  const beginJoin = useCallback(
    (roomId: number, game: ServerInfo_Game, asSpectator: boolean, asJudge: boolean) => {
      setPendingSpectatorJoin(null);
      setPendingPasswordJoin(null);
      const gameFull = game.playerCount === game.maxPlayers;
      const effectiveSpectator = asSpectator || gameFull;
      const join = { roomId, gameId: game.gameId, description: game.description, asSpectator: effectiveSpectator, asJudge };
      if (activeGameIds.includes(game.gameId)) {
        sendJoin(join, '');
        return;
      }
      const needsPassword = !overrideRestrictions && game.withPassword && !(effectiveSpectator && !game.spectatorsNeedPassword);
      if (gameFull && !asSpectator && !asJudge && !overrideRestrictions) {
        setPendingSpectatorJoin({ join, needsPassword });
        return;
      }
      if (needsPassword) {
        setPendingPasswordJoin(join);
        return;
      }
      sendJoin(join, '');
    },
    [activeGameIds, overrideRestrictions, sendJoin],
  );

  const confirmSpectatorJoin = useCallback(() => {
    if (!pendingSpectatorJoin) {
      return;
    }
    const { join, needsPassword } = pendingSpectatorJoin;
    setPendingSpectatorJoin(null);
    if (needsPassword) {
      setPendingPasswordJoin(join);
    } else {
      sendJoin(join, '');
    }
  }, [pendingSpectatorJoin, sendJoin]);
  const cancelSpectatorJoin = useCallback(() => setPendingSpectatorJoin(null), []);

  const submitPassword = useCallback(
    (password: string) => {
      if (pendingPasswordJoin) {
        sendJoin(pendingPasswordJoin, password);
        setPendingPasswordJoin(null);
      }
    },
    [pendingPasswordJoin, sendJoin],
  );

  const cancelPassword = useCallback(() => setPendingPasswordJoin(null), []);
  const clearJoinError = useCallback(() => {
    if (joinError?.requestId !== undefined && storedJoinError?.requestId === joinError.requestId) {
      dispatch(rooms.Actions.clearJoinGameError());
    }
    request.cancel();
    setJoinError(null);
  }, [dispatch, joinError, request, storedJoinError]);

  return {
    beginJoin,
    passwordRequired: pendingPasswordJoin !== null,
    passwordGame: pendingPasswordJoin,
    submitPassword,
    cancelPassword,
    spectatorConfirmationRequired: pendingSpectatorJoin !== null,
    confirmSpectatorJoin,
    cancelSpectatorJoin,
    joinPending,
    joinError,
    clearJoinError,
  };
}

const routedJoins = new WeakSet<object>();

export function useNavigateOnGameJoined(onJoined?: (gameId: number) => void): void {
  const navigate = useNavigate();
  useReduxEffect<{ data: Event_GameJoined }>((action) => {
    const gameId = action.payload.data.gameInfo?.gameId;
    if (gameId == null) {
      return;
    }
    onJoined?.(gameId);
    if (routedJoins.has(action)) {
      return;
    }
    routedJoins.add(action);
    navigate(generatePath(RouteEnum.GAME, { gameId: gameId.toString() }));
  }, games.Types.GAME_JOINED, [navigate, onJoined]);
}
