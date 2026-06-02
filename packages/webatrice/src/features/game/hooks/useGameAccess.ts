import { useMemo } from 'react';
import { games, type GameEntry } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

export interface GameAccess {
  canAct: boolean;
  canView: boolean;
  isLocalPlayer: boolean;
  // Local user identity for this game — the single source for judge/seat checks
  // (e.g. useJudgeTarget). Target-agnostic: same regardless of targetPlayerId.
  isJudge: boolean;
  localPlayerId: number | undefined;
}

/**
 * Canonical "can the local user act on this seat" rule. With no target it asks
 * whether the local user can act at all (a seated, non-spectating player). Judges
 * may act on anyone. Pure so it can be reused outside a hook (e.g. per board cell).
 */
export function computeCanAct(game: GameEntry, targetPlayerId?: number): boolean {
  const isLocalPlayer = targetPlayerId != null && targetPlayerId === game.localPlayerId;
  const noTargetButLocalControls = targetPlayerId == null && !game.spectator;
  return game.judge || (!game.spectator && (isLocalPlayer || noTargetButLocalControls));
}

export function useGameAccess(gameId: number | undefined, targetPlayerId?: number): GameAccess {
  const game = useAppSelector((state) =>
    gameId != null ? games.Selectors.getGame(state, gameId) : undefined,
  );

  return useMemo<GameAccess>(() => {
    if (!game) {
      return { canAct: false, canView: false, isLocalPlayer: false, isJudge: false, localPlayerId: undefined };
    }
    return {
      canAct: computeCanAct(game, targetPlayerId),
      canView: true,
      isLocalPlayer: targetPlayerId != null && targetPlayerId === game.localPlayerId,
      isJudge: game.judge,
      localPlayerId: game.localPlayerId,
    };
  }, [game, targetPlayerId]);
}
