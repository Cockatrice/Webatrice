import { ZoneName } from '@cockatrice/sockatrice';
import { ShortcutScope, useShortcut } from '@app/feature-widgets/shortcuts';
import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppDispatch } from '@app/store';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { useCurrentGame } from './useCurrentGame';
import { useGameAffordances } from './useGameAffordances';

const PHASE_COUNT = 11;

interface UseGameShortcutsArgs {
  gameId: number | undefined;
  onRequestConcede: () => void;
  onRequestDrawMultiple: () => void;
  onRequestUndoDraw: () => void;
  onRequestRollDie: () => void;
  onRequestLeave: () => void;
  onRequestViewSideboard: () => void;
  onRequestSortHandByType: () => void;
  onRequestViewLibrary: () => void;
  onRequestViewGraveyard: () => void;
  onRequestPlayTop: () => void;
  onRequestMoveTopToGrave: () => void;
  onRequestMoveTopNToGrave: () => void;
  onCloseRecentZoneView: () => boolean;
}

export function useGameShortcuts({
  gameId,
  onRequestConcede,
  onRequestDrawMultiple,
  onRequestUndoDraw,
  onRequestRollDie,
  onRequestLeave,
  onRequestViewSideboard,
  onRequestSortHandByType,
  onRequestViewLibrary,
  onRequestViewGraveyard,
  onRequestPlayTop,
  onRequestMoveTopToGrave,
  onRequestMoveTopNToGrave,
  onCloseRecentZoneView,
}: UseGameShortcutsArgs): void {
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
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
      // Wire zone names are lowercase (`ZoneName.DECK === 'deck'`);
      // passing uppercase `'DECK'` here silently no-ops server-side
      // because Servatrice matches zone names case-sensitively.
      webClient.request.game.shuffle(gameId, { zoneName: ZoneName.DECK, start: 0, end: -1 });
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
      // Optimistic: flip the phase locally so the phase tracker
      // highlights the new phase immediately, then fire the wire
      // with `onError` to revert if the server rejects.
      dispatch(games.Actions.activePhaseSet({ gameId, phase: next }));
      webClient.request.game.setActivePhase(gameId, { phase: next }, {
        onError: (code) => {
          console.warn(`setActivePhase(next) rejected (${code}); rolling back to phase ${current}`);
          dispatch(games.Actions.activePhaseSet({ gameId, phase: current }));
        },
      });
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
      dispatch(games.Actions.activePhaseSet({ gameId, phase: prev }));
      webClient.request.game.setActivePhase(gameId, { phase: prev }, {
        onError: (code) => {
          console.warn(`setActivePhase(prev) rejected (${code}); rolling back to phase ${current}`);
          dispatch(games.Actions.activePhaseSet({ gameId, phase: current }));
        },
      });
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  // Drawing utilities — dialog-based, so we only gate on participation
  // rather than active player.
  useShortcut(
    'game.drawMultipleCards',
    () => {
      if (!canPassTurn || gameId == null) {
        return;
      }
      onRequestDrawMultiple();
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  useShortcut(
    'game.undoDraw',
    () => {
      if (!canPassTurn || gameId == null) {
        return;
      }
      onRequestUndoDraw();
    },
    { scope: ShortcutScope.GAME, enabled: inGame },
  );

  // Roll die — opens the roll-die dialog. Participation gate: spectators
  // don't roll dice for the game (they can't submit game commands).
  useShortcut(
    'game.rollDice',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestRollDie();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  // Leave game — mirrors Cockatrice's Ctrl+Q. Opens the confirm dialog
  // (same guard-rail as the sidebar Leave button).
  useShortcut(
    'game.leaveGame',
    () => {
      if (gameId == null) {
        return;
      }
      onRequestLeave();
    },
    { scope: ShortcutScope.GAME, enabled: hasLiveGame },
  );

  // View sideboard — opens the local player's sideboard viewer. Owner-
  // only (spectators / opponents don't have a sideboard to view).
  useShortcut(
    'game.viewSideboard',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestViewSideboard();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  // Mulligan (Same hand size) — matches Cockatrice's aMulliganSame.
  // Redraws N cards where N is the current hand size.
  useShortcut(
    'game.mulliganSameSize',
    () => {
      if (!isParticipant || gameId == null || game == null) {
        return;
      }
      const handCount =
        game.players[game.localPlayerId]?.zones[ZoneName.HAND]?.cardCount ?? 0;
      webClient.request.game.mulligan(gameId, { number: handCount });
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  // Mulligan (Hand size - 1) — mirrors desktop's aMulliganMinusOne;
  // floors at 1 because Servatrice's doMulligan rejects number < 1.
  useShortcut(
    'game.mulliganMinusOne',
    () => {
      if (!isParticipant || gameId == null || game == null) {
        return;
      }
      const handCount =
        game.players[game.localPlayerId]?.zones[ZoneName.HAND]?.cardCount ?? 0;
      const next = Math.max(1, handCount - 1);
      webClient.request.game.mulligan(gameId, { number: next });
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  // Sort Hand by Type — matches Cockatrice's aSortHandByType. Fires
  // per-card moveCard within the hand to sort by main type.
  useShortcut(
    'game.sortHandByType',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestSortHandByType();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  // View Library / Graveyard — opens the local player's full-pile
  // viewer (LibrarySearchDialog with search/group/sort). Owner-only.
  // Both routes trigger the same dialog the battlefield right-click
  // "View library" / "View graveyard" menus open — the actual dialog
  // state lives inside PlayerBox (entangled with enrichedDeckCards
  // and the dump/close plumbing), so these hooks flip a boolean via
  // useGameDialogs that PlayerBox subscribes to.
  useShortcut(
    'game.viewLibrary',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestViewLibrary();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  useShortcut(
    'game.viewGraveyard',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestViewGraveyard();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  // Top-of-library shortcuts. All operate on the local player's own
  // library — mirrors Cockatrice's library right-click menu items.
  useShortcut(
    'game.playTop',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestPlayTop();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  useShortcut(
    'game.moveTopToGrave',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestMoveTopToGrave();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  useShortcut(
    'game.moveTopNToGrave',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      onRequestMoveTopNToGrave();
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );

  // Close Recent View — Esc closes the topmost open zone-view dialog.
  // The handler returns whether it actually closed anything so we can
  // let modal / menu-native Esc handlers still run when no zone view is
  // open (returning `true` swallows the event via preventDefault).
  useShortcut(
    'game.closeRecentView',
    (event) => {
      const closed = onCloseRecentZoneView();
      if (closed) {
        event.preventDefault();
      }
    },
    { scope: ShortcutScope.GAME, enabled: hasLiveGame },
  );

  // Flip Coin — mirrors Cockatrice's aFlipCoin (Ctrl+Shift+I). Fires
  // a single 2-sided die roll; the server broadcasts Event_RollDie
  // and the log formatter renders "flipped a coin. It landed as
  // Heads/Tails." (see messageLog.ts).
  useShortcut(
    'game.flipCoin',
    () => {
      if (!isParticipant || gameId == null) {
        return;
      }
      webClient.request.game.rollDie(gameId, { sides: 2, count: 1 });
    },
    { scope: ShortcutScope.GAME, enabled: inGame && isParticipant },
  );
}
