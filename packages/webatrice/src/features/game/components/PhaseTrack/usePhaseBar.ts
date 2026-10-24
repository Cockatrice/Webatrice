import { useStore } from 'react-redux';
import { ZoneName } from '@cockatrice/sockatrice';
import type { RequestId } from '@cockatrice/sockatrice/types';
import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector, type RootState } from '@app/store';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { Phase } from '@cockatrice/datatrice';
import { useGameAffordances } from '../../hooks/useGameAffordances';

export interface PhaseBar {
  activePhase: Phase | undefined;
  canPassTurn: boolean;
  canReverseTurn: boolean;
  canAdvancePhase: boolean;
  handlePhaseClick: (phase: Phase) => void;
  handlePass: () => void;
  handleUntapAll: () => void;
  handleDrawOne: () => void;
  handlePassAndUntap: (...correlation: [requestId?: RequestId]) => RequestId | undefined;
  handleReverseTurn: () => void;
}

export function usePhaseBar(gameId: number | undefined): PhaseBar {
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const { canPassTurn, canReverseTurn, canAdvancePhase } = useGameAffordances(gameId);
  const activePhase = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePhase(state, gameId) : undefined,
  );

  const handlePhaseClick = (phase: Phase) => {
    if (!canAdvancePhase || gameId == null) {
      return;
    }
    // Optimistic: snapshot the current phase for rollback, dispatch
    // the new phase locally so the tracker highlights immediately,
    // then fire the wire with `onError` to revert if the server
    // rejects. activePhaseSet is a plain field assignment reducer
    // (idempotent), so the server's echo just re-applies the same
    // value on success.
    const previousPhase = games.Selectors.getActivePhase(store.getState(), gameId);
    dispatch(games.Actions.activePhaseSet({ gameId, phase }));
    webClient.request.game.setActivePhase(gameId, { phase }, {
      onError: (code) => {
        console.warn(`setActivePhase rejected (${code}); rolling back to phase ${previousPhase}`);
        if (previousPhase != null) {
          dispatch(games.Actions.activePhaseSet({ gameId, phase: previousPhase }));
        }
      },
    });
  };

  const sendPass = (...correlation: [requestId?: RequestId]): RequestId | undefined => {
    if (!canPassTurn || gameId == null) {
      return;
    }
    webClient.request.game.nextTurn(gameId, ...correlation);
    return correlation[0];
  };

  const handlePass = () => {
    sendPass();
  };

  const sendUntapAll = (id: number) => {
    webClient.request.game.setCardAttr(id, {
      zone: ZoneName.TABLE,
      cardId: -1,
      attribute: CardAttribute.AttrTapped,
      attrValue: '0',
    });
  };

  const handleReverseTurn = () => {
    if (!canReverseTurn || gameId == null) {
      return;
    }
    webClient.request.game.reverseTurn(gameId);
  };

  // Untap-step double-click → Untap All. See .github/instructions/webatrice-game.instructions.md#phase-model.
  const handleUntapAll = () => {
    if (!canAdvancePhase || gameId == null) {
      return;
    }
    sendUntapAll(gameId);
  };

  const handlePassAndUntap = (...correlation: [requestId?: RequestId]): RequestId | undefined => {
    if (!canPassTurn || gameId == null) {
      return;
    }
    const requestId = sendPass(...correlation);
    sendUntapAll(gameId);
    return requestId;
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
    canReverseTurn,
    canAdvancePhase,
    handlePhaseClick,
    handlePass,
    handleUntapAll,
    handleDrawOne,
    handlePassAndUntap,
    handleReverseTurn,
  };
}
