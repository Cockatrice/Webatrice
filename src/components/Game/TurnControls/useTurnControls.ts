import { useMemo, useState } from 'react';

import { LoadingState, useCurrentGame, useGameAffordances, useLeaveGame, useSettings, useWebClient } from '@app/hooks';
import { GameSelectors, useAppSelector } from '@app/store';

/**
 * MTG turn phase count (0..10). Mirrors desktop's wrap-around behavior in
 * `GameView::actNextPhase` — see `types/game.ts` for the Phase enum.
 */
const PHASE_COUNT = 11;

export interface TurnControlsOpponent {
  playerId: number;
  name: string;
}

export interface TurnControls {
  isHost: boolean;
  isConceded: boolean;
  invertVerticalCoordinate: boolean;
  settingsReady: boolean;
  canPassTurn: boolean;
  canAdvancePhase: boolean;
  canLeave: boolean;
  canConcede: boolean;
  canUnconcede: boolean;
  canRoll: boolean;
  canKick: boolean;
  canRemoveArrows: boolean;
  hasLiveGame: boolean;
  opponents: TurnControlsOpponent[];
  kickAnchor: HTMLElement | null;
  setKickAnchor: (el: HTMLElement | null) => void;
  handlePassTurn: () => void;
  handleReverseTurn: () => void;
  handleNextPhase: () => void;
  handleConcedeToggle: () => void;
  handleRemoveArrows: () => void;
  handleLeave: () => void;
  handleToggleInvert: () => void;
  handleKick: (playerId: number) => void;
}

export interface UseTurnControlsArgs {
  gameId: number | undefined;
  onRequestConcede: () => void;
  onRequestUnconcede: () => void;
}

export function useTurnControls({
  gameId,
  onRequestConcede,
  onRequestUnconcede,
}: UseTurnControlsArgs): TurnControls {
  const webClient = useWebClient();
  const leaveGame = useLeaveGame();
  const { game, isHost } = useCurrentGame(gameId);
  // Per-turn affordances (canPassTurn, canAdvancePhase, canConcede, canRoll, …)
  // come from the shared hook so this hook, usePhaseBar, and useGameShortcuts
  // can't drift from each other on gating semantics.
  const {
    hasLiveGame,
    isConceded,
    canPassTurn,
    canAdvancePhase,
    canConcede,
    canUnconcede,
    canRoll,
  } = useGameAffordances(gameId);
  const { status: settingsStatus, value: settings, update: updateSettings } = useSettings();
  const invertVerticalCoordinate = settings?.invertVerticalCoordinate ?? false;

  const [kickAnchor, setKickAnchor] = useState<HTMLElement | null>(null);

  const opponents = useMemo<TurnControlsOpponent[]>(() => {
    if (!game) {
      return [];
    }
    return Object.values(game.players)
      .filter((p) => p.properties.playerId !== game.localPlayerId)
      .map((p) => ({
        playerId: p.properties.playerId,
        name: p.properties.userInfo?.name ?? `p${p.properties.playerId}`,
      }));
  }, [game]);

  // Local arrows belong to `localPlayerId`; Remove Local Arrows iterates
  // and deletes each one. Matches desktop's Player::actRemoveLocalArrows.
  const localArrows = useAppSelector((state) =>
    gameId != null && game != null
      ? GameSelectors.getArrows(state, gameId, game.localPlayerId)
      : undefined,
  );
  const localArrowIds = useMemo(
    () => (localArrows ? Object.keys(localArrows).map(Number) : []),
    [localArrows],
  );

  const canLeave = hasLiveGame;
  const canKick = gameId != null && isHost && opponents.length > 0;
  const canRemoveArrows = hasLiveGame && localArrowIds.length > 0;

  const handlePassTurn = () => {
    if (!canPassTurn || !hasLiveGame) {
      return;
    }
    webClient.request.game.nextTurn(gameId);
  };

  const handleReverseTurn = () => {
    if (!canPassTurn || !hasLiveGame) {
      return;
    }
    webClient.request.game.reverseTurn(gameId);
  };

  const handleNextPhase = () => {
    if (!canAdvancePhase || !hasLiveGame) {
      return;
    }
    // Desktop wraps at PHASE_COUNT → 0 (the Phase enum is 0–10). When no phase
    // is active yet (activePhase < 0 during the pre-game lobby), advance to
    // Untap (0).
    const current = game.activePhase;
    const next = current >= 0 ? (current + 1) % PHASE_COUNT : 0;
    webClient.request.game.setActivePhase(gameId, { phase: next });
  };

  const handleConcedeToggle = () => {
    if (!hasLiveGame || (!canConcede && !canUnconcede)) {
      return;
    }
    if (isConceded) {
      onRequestUnconcede();
    } else {
      onRequestConcede();
    }
  };

  const handleRemoveArrows = () => {
    if (!canRemoveArrows) {
      return;
    }
    for (const arrowId of localArrowIds) {
      webClient.request.game.deleteArrow(gameId, { arrowId });
    }
  };

  const handleLeave = () => {
    if (!canLeave || !hasLiveGame) {
      return;
    }
    leaveGame(gameId);
  };

  const handleToggleInvert = () => {
    if (settingsStatus !== LoadingState.READY) {
      return;
    }
    void updateSettings({ invertVerticalCoordinate: !invertVerticalCoordinate });
  };

  const handleKick = (playerId: number) => {
    if (!hasLiveGame) {
      return;
    }
    webClient.request.game.kickFromGame(gameId, { playerId });
    setKickAnchor(null);
  };

  return {
    isHost,
    isConceded,
    invertVerticalCoordinate,
    settingsReady: settingsStatus === LoadingState.READY,
    canPassTurn,
    canAdvancePhase,
    canLeave,
    canConcede,
    canUnconcede,
    canRoll,
    canKick,
    canRemoveArrows,
    hasLiveGame,
    opponents,
    kickAnchor,
    setKickAnchor,
    handlePassTurn,
    handleReverseTurn,
    handleNextPhase,
    handleConcedeToggle,
    handleRemoveArrows,
    handleLeave,
    handleToggleInvert,
    handleKick,
  };
}
