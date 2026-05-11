import { useMemo } from 'react';

import { useCurrentGame } from './useCurrentGame';

export interface GameAffordances {
  hasLiveGame: boolean;
  isParticipant: boolean;
  isConceded: boolean;
  isStarted: boolean;
  canPassTurn: boolean;
  canAdvancePhase: boolean;
  canConcede: boolean;
  canUnconcede: boolean;
  canRoll: boolean;
}

export function useGameAffordances(gameId: number | undefined): GameAffordances {
  const { game, localPlayer, isSpectator, isJudge, isStarted } = useCurrentGame(gameId);

  return useMemo<GameAffordances>(() => {
    const hasLiveGame = gameId != null && game != null;
    const isParticipant = hasLiveGame && !isSpectator;
    const isConceded = localPlayer?.properties.conceded ?? false;
    const canPassTurn =
      hasLiveGame && isStarted && !isConceded && (isJudge || isParticipant);
    const canAdvancePhase =
      hasLiveGame && isStarted && (isJudge || game.activePlayerId === game.localPlayerId);
    const canConcede = isParticipant && !isConceded;
    const canUnconcede = isParticipant && isConceded;
    const canRoll = hasLiveGame && (isParticipant || isJudge);

    return {
      hasLiveGame,
      isParticipant,
      isConceded,
      isStarted,
      canPassTurn,
      canAdvancePhase,
      canConcede,
      canUnconcede,
      canRoll,
    };
  }, [gameId, game, localPlayer, isSpectator, isJudge, isStarted]);
}
