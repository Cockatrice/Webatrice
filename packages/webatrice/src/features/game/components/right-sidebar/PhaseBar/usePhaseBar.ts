import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { Enriched, Phase } from '@cockatrice/datatrice';
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
  const { canPassTurn, canAdvancePhase } = useGameAffordances(gameId);
  const activePhase = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePhase(state, gameId) : undefined,
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
    if (!canAdvancePhase || gameId == null) {
      return;
    }
    webClient.request.game.setCardAttr(gameId, {
      zone: Enriched.ZoneName.TABLE,
      cardId: -1,
      attribute: CardAttribute.AttrTapped,
      attrValue: '0',
    });
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
