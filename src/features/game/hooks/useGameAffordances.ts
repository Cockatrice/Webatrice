import { useMemo } from 'react';

import { useCurrentGame } from './useCurrentGame';

export interface GameAffordances {
  /** True iff the route resolves to a game and that game still exists in the store. */
  hasLiveGame: boolean;
  /** True for active players and judges; false for pure spectators. */
  isParticipant: boolean;
  /** True when the local player has conceded (read from their player properties). */
  isConceded: boolean;
  /** True once the host has started the game (lobby has closed). */
  isStarted: boolean;
  /**
   * cmdNextTurn / cmdReverseTurn don't require the active player flag — any
   * non-conceded participant or judge can pass / reverse. Mirrors the server's
   * server_player.cpp behavior; see usePhaseBar's original derivation.
   */
  canPassTurn: boolean;
  /**
   * cmdSetActivePhase requires the local player to be the active player (or a judge).
   * Different gating from canPassTurn.
   */
  canAdvancePhase: boolean;
  /** Concede toggle: only meaningful for participants who haven't already conceded. */
  canConcede: boolean;
  /** Symmetric inverse of canConcede; participants who already conceded can un-concede. */
  canUnconcede: boolean;
  /** Rolling dice: participants and judges; pure spectators cannot. */
  canRoll: boolean;
}

/**
 * Single source of truth for "what can the local user do this turn". Derived from
 * useCurrentGame so it auto-updates when the game state, active player, or concede
 * status changes. Consumed by usePhaseBar, useTurnControls, and useGameShortcuts —
 * keeps the gating rules aligned across click and keyboard call sites.
 */
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
