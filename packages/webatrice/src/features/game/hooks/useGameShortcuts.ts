import { ZoneName } from '@cockatrice/sockatrice';
import { ShortcutScope, useShortcut } from '@app/feature-widgets/shortcuts';
import { useWebClient } from '@cockatrice/datatrice/react';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { useCurrentGame } from './useCurrentGame';
import { useGameAffordances } from './useGameAffordances';

const PHASE_COUNT = 11;

interface UseGameShortcutsArgs {
  gameId: number | undefined;
  onRequestConcede: () => void;
}

export function useGameShortcuts({ gameId, onRequestConcede }: UseGameShortcutsArgs): void {
  const webClient = useWebClient();
  const { game } = useCurrentGame(gameId);
  const {
    hasLiveGame,
    isStarted,
    isParticipant,
    canPassTurn,
    canAdvancePhase,
    canConcede,
  } = useGameAffordances(gameId);
  const inGame = hasLiveGame && isStarted;

  useShortcut(
    'game.untapAll',
    () => {
      if (!canAdvancePhase || gameId == null) {
        return;
      }
      webClient.request.game.setCardAttr(gameId, {
        zone: ZoneName.TABLE,
        cardId: -1,
        attribute: CardAttribute.AttrTapped,
        attrValue: '0',
      });
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  useShortcut(
    'game.drawCard',
    () => {
      // Draw is allowed off-turn; canPassTurn is the right gate (canAdvancePhase requires active player).
      if (!canPassTurn || gameId == null) {
        return;
      }
      webClient.request.game.drawCards(gameId, { number: 1 });
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  useShortcut(
    'game.endTurn',
    () => {
      if (!canPassTurn || gameId == null) {
        return;
      }
      webClient.request.game.nextTurn(gameId);
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  useShortcut(
    'game.concede',
    () => {
      if (!canConcede) {
        return;
      }
      onRequestConcede();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && canConcede },
  );

  useShortcut(
    'game.shuffleLibrary',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      webClient.request.game.shuffle(gameId, { zoneName: 'DECK', start: 0, end: -1 });
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  useShortcut(
    'game.nextPhase',
    () => {
      if (!canAdvancePhase || gameId == null || game == null) {
        return;
      }
      const current = game.activePhase;
      const next = current >= 0 ? (current + 1) % PHASE_COUNT : 0;
      webClient.request.game.setActivePhase(gameId, { phase: next });
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  useShortcut(
    'game.prevPhase',
    () => {
      if (!canAdvancePhase || gameId == null || game == null) {
        return;
      }
      const current = game.activePhase;
      const prev = current > 0 ? current - 1 : PHASE_COUNT - 1;
      webClient.request.game.setActivePhase(gameId, { phase: prev });
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );
}
