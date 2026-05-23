import { useMemo } from 'react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { GameEntry, PlayerEntry } from '@cockatrice/datatrice';
export interface CurrentGame {
  gameId: number | undefined;
  game: GameEntry | undefined;
  localPlayer: PlayerEntry | undefined;
  isSpectator: boolean;
  isJudge: boolean;
  isHost: boolean;
  isStarted: boolean;
}

export function useCurrentGame(gameId?: number): CurrentGame {
  const activeGameIds = useAppSelector(games.Selectors.getActiveGameIds);

  const resolvedGameId: number | undefined =
    gameId ?? (activeGameIds.length > 0 ? activeGameIds[0] : undefined);

  const game = useAppSelector((state) =>
    resolvedGameId != null ? games.Selectors.getGame(state, resolvedGameId) : undefined,
  );

  return useMemo<CurrentGame>(() => {
    if (!game || resolvedGameId == null) {
      return {
        gameId: resolvedGameId,
        game: undefined,
        localPlayer: undefined,
        isSpectator: false,
        isJudge: false,
        isHost: false,
        isStarted: false,
      };
    }
    const localPlayer = game.players[game.localPlayerId];
    return {
      gameId: resolvedGameId,
      game,
      localPlayer,
      isSpectator: game.spectator,
      isJudge: game.judge,
      isHost: game.hostId === game.localPlayerId,
      isStarted: game.started,
    };
  }, [game, resolvedGameId]);
}
