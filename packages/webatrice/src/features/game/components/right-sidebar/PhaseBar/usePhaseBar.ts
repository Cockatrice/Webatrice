import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { Enriched, Phase } from '@cockatrice/datatrice';
import { useCurrentGame } from '../../../hooks/useCurrentGame';
import { useGameAffordances } from '../../../hooks/useGameAffordances';

export interface PhaseBar {
  activePhase: Phase | undefined;
  canPassTurn: boolean;
  canAdvancePhase: boolean;
  handlePhaseClick: (phase: Phase) => void;
  handlePass: () => void;
  handleUntapAll: () => void;
  handleDrawOne: () => void;
}

export function usePhaseBar(gameId: number | undefined): PhaseBar {
  const webClient = useWebClient();
  const { game } = useCurrentGame(gameId);
  const { canPassTurn, canAdvancePhase } = useGameAffordances(gameId);
  const activePhase = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePhase(state, gameId) : undefined,
  );
  const localPlayerId = game?.localPlayerId;
  const tableCards = useAppSelector((state) =>
    gameId != null && localPlayerId != null
      ? games.Selectors.getCards(state, gameId, localPlayerId, Enriched.ZoneName.TABLE)
      : undefined,
  );

  const handlePhaseClick = (phase: Phase) => {
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
          zone: Enriched.ZoneName.TABLE,
          cardId: card.id,
          attribute: CardAttribute.AttrTapped,
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
