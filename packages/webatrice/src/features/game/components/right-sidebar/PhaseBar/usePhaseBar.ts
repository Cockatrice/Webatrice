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

  // Untap-step double-click → Untap All. See .github/instructions/webatrice-game.instructions.md#phase-model.
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
