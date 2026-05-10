import { useCurrentGame, useWebClient } from '@app/hooks';
import { GameSelectors, useAppSelector } from '@app/store';
import { App, Data } from '@app/types';

export interface PhaseBar {
  activePhase: App.Phase | undefined;
  canPassTurn: boolean;
  canAdvancePhase: boolean;
  handlePhaseClick: (phase: App.Phase) => void;
  handlePass: () => void;
  handleUntapAll: () => void;
  handleDrawOne: () => void;
}

export function usePhaseBar(gameId: number | undefined): PhaseBar {
  const webClient = useWebClient();
  const { game, localPlayer, isSpectator, isJudge, isStarted } = useCurrentGame(gameId);
  const activePhase = useAppSelector((state) =>
    gameId != null ? GameSelectors.getActivePhase(state, gameId) : undefined,
  );
  const localPlayerId = game?.localPlayerId;
  const tableCards = useAppSelector((state) =>
    gameId != null && localPlayerId != null
      ? GameSelectors.getCards(state, gameId, localPlayerId, App.ZoneName.TABLE)
      : undefined,
  );

  const isParticipant = gameId != null && game != null && !isSpectator;
  const isConceded = localPlayer?.properties.conceded ?? false;
  // Cockatrice's server allows any non-conceded participant or judge to pass
  // the turn (server_player.cpp cmdNextTurn has no active-player check). Only
  // setActivePhase is gated on the active player.
  const canPassTurn =
    gameId != null && game != null && isStarted && !isConceded &&
    (isJudge || isParticipant);
  const canAdvancePhase =
    gameId != null &&
    game != null &&
    isStarted &&
    (isJudge || game.activePlayerId === game.localPlayerId);

  const handlePhaseClick = (phase: App.Phase) => {
    if (!canAdvancePhase || gameId == null) {
      return;
    }
    webClient.request.game.setActivePhase(gameId, { phase });
  };

  const handlePass = () => {
    if (!canPassTurn || gameId == null) {
      return;
    }
    webClient.request.game.nextTurn(gameId);
  };

  // Desktop's untap-step double-click fires "Untap All" on the local player's
  // table zone (cockatrice/src/game/player/player_actions.cpp actUntapAll).
  // We replicate by sending one setCardAttr per tapped card; there is no
  // batch variant on the wire. Gated to the active player (or judge) since
  // it's a start-of-your-turn action.
  const handleUntapAll = () => {
    if (!canAdvancePhase || gameId == null || !tableCards) {
      return;
    }
    for (const card of tableCards) {
      if (card.tapped) {
        webClient.request.game.setCardAttr(gameId, {
          zone: App.ZoneName.TABLE,
          cardId: card.id,
          attribute: Data.CardAttribute.AttrTapped,
          attrValue: '0',
        });
      }
    }
  };

  const handleDrawOne = () => {
    if (!canAdvancePhase || gameId == null) {
      return;
    }
    webClient.request.game.drawCards(gameId, { number: 1 });
  };

  return {
    activePhase,
    canPassTurn,
    canAdvancePhase,
    handlePhaseClick,
    handlePass,
    handleUntapAll,
    handleDrawOne,
  };
}
