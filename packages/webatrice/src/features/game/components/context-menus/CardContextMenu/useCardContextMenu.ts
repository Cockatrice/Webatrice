import { ZoneName } from '@cockatrice/sockatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { useJudgeTarget } from '../../../hooks/useJudgeTarget';
import { effectiveTargets, type SelectedCard } from '../../../utils/selection';
interface MoveTarget {
  label: string;
  zone: string;
  x: number;
  y: number;
}

// Desktop 7-entry move menu. See .github/instructions/webatrice-game.instructions.md#dialog-parity.
export const CARD_MOVE_TARGETS: ReadonlyArray<MoveTarget> = [
  { label: 'Send to Hand', zone: ZoneName.HAND, x: -1, y: 0 },
  { label: 'Send to Battlefield', zone: ZoneName.TABLE, x: 0, y: 0 },
  { label: 'Send to Graveyard', zone: ZoneName.GRAVE, x: 0, y: 0 },
  { label: 'Send to Exile', zone: ZoneName.EXILE, x: 0, y: 0 },
  { label: 'Send to Library (top)', zone: ZoneName.DECK, x: 0, y: 0 },
  { label: 'Send to Library (bottom)', zone: ZoneName.DECK, x: -1, y: 0 },
];

export interface CardContextMenu {
  ready: boolean;
  // Local user may act on this card — owns it, or is a judge (parity with
  // Cockatrice's writeableCard = getLocalOrJudge()). Gates the writeable menu.
  canActOnCard: boolean;
  canAttach: boolean;
  isAttached: boolean;
  canPlay: boolean;
  canPeek: boolean;
  moveTargets: ReadonlyArray<MoveTarget>;
  handleTapToggle: () => void;
  handleFaceDownToggle: () => void;
  handleDoesntUntapToggle: () => void;
  handleSetPT: () => void;
  handleSetAnnotation: () => void;
  handleCardCounterDelta: (counterId: number, delta: number) => void;
  handleSetCardCounter: (counterId: number) => void;
  handleDrawArrow: () => void;
  handleAttach: () => void;
  handleUnattach: () => void;
  handlePlay: () => void;
  handlePlayFaceDown: () => void;
  handlePeek: () => void;
  handleMove: (target: MoveTarget) => void;
  handleMoveToLibraryAt: () => void;
}

export interface UseCardContextMenuArgs {
  gameId: number | undefined;
  localPlayerId: number | null;
  card: ServerInfo_Card | null;
  ownerPlayerId: number | null;
  sourceZone: string | null;
  // The current multi-selection, resolved to live cards. The menu acts on the
  // whole set only when the right-clicked card is part of a ≥2 selection.
  selectedCards?: readonly SelectedCard[];
  onClose: () => void;
  onRequestSetPT: () => void;
  onRequestSetAnnotation: () => void;
  onRequestSetCounter: (counterId: number) => void;
  onRequestDrawArrow: () => void;
  onRequestAttach: () => void;
  onRequestPlay: (faceDown: boolean) => void;
  onRequestMoveToLibraryAt: () => void;
}

const EMPTY_SELECTED_CARDS: readonly SelectedCard[] = [];

export function useCardContextMenu({
  gameId,
  localPlayerId,
  card,
  ownerPlayerId,
  sourceZone,
  selectedCards = EMPTY_SELECTED_CARDS,
  onClose,
  onRequestSetPT,
  onRequestSetAnnotation,
  onRequestSetCounter,
  onRequestDrawArrow,
  onRequestAttach,
  onRequestPlay,
  onRequestMoveToLibraryAt,
}: UseCardContextMenuArgs): CardContextMenu {
  const webClient = useWebClient();
  // Encapsulated judge rule: yields the owner to wrap as, or undefined for own/non-judge.
  const judgeTarget = useJudgeTarget(gameId);

  const ready = card != null && ownerPlayerId != null && sourceZone != null && localPlayerId != null;

  // The set every card action operates on: the multi-selection when this card is
  // part of one, else just this card. Always ≥1, so each handler feeds it to a
  // bulk dispatcher unconditionally (single = the n=1 case). See effectiveTargets.
  const actionTargets = ready
    ? effectiveTargets(selectedCards, { ownerPlayerId: ownerPlayerId!, zone: sourceZone!, card: card! })
    : EMPTY_SELECTED_CARDS;

  // Card-menu affordance gates. See .github/instructions/webatrice-game.instructions.md#dialog-parity.
  const isOwnedByLocal = ready && ownerPlayerId === localPlayerId;
  // A judge acting on a foreign card wraps every command in Command_Judge (target =
  // owner) so the server runs it as the owner; undefined for own cards (sent bare).
  const judgeTargetId = ready ? judgeTarget(ownerPlayerId!) : undefined;
  // Writeable-card gate: own card, or a judge acting on a foreign card.
  const canActOnCard = ready && (isOwnedByLocal || judgeTargetId !== undefined);
  const isAttached = ready && (card!.attachCardId ?? -1) >= 0;
  const canAttach = ready && sourceZone === ZoneName.TABLE;
  // A judge may play a foreign card onto its owner's table (playCard.ts targets the
  // owner and judge-wraps), matching Cockatrice's getLocalOrJudge() play gate.
  const canPlay = ready && canActOnCard && sourceZone !== ZoneName.TABLE;
  const canPeek =
    ready && canActOnCard && sourceZone === ZoneName.TABLE && (card!.faceDown ?? false);

  // Tap/flip/doesn't-untap act on the TABLE subset of the selection. The bulk
  // dispatchers apply Cockatrice's collective rule (which reduces to a plain
  // toggle for a single card) and judge-wrap per owner. See bulkCardActions.
  const tableTargets = () => actionTargets.filter((t) => t.zone === ZoneName.TABLE);

  const handleTapToggle = () => {
    if (!ready || gameId == null) {
      return;
    }
    webClient.request.game.bulkTap(gameId, tableTargets(), judgeTarget);
    onClose();
  };

  const handleFaceDownToggle = () => {
    if (!ready || gameId == null) {
      return;
    }
    webClient.request.game.bulkFlip(gameId, tableTargets(), judgeTarget);
    onClose();
  };

  const handleDoesntUntapToggle = () => {
    if (!ready || gameId == null) {
      return;
    }
    webClient.request.game.bulkDoesntUntap(gameId, tableTargets(), judgeTarget);
    onClose();
  };

  const handleSetPT = () => {
    onRequestSetPT();
    onClose();
  };

  const handleSetAnnotation = () => {
    onRequestSetAnnotation();
    onClose();
  };

  const handleCardCounterDelta = (counterId: number, delta: number) => {
    if (!ready || gameId == null) {
      return;
    }
    webClient.request.game.incCardCounter(gameId, {
      zone: sourceZone!,
      cardId: card!.id,
      counterId,
      counterDelta: delta,
    }, judgeTargetId);
    onClose();
  };

  const handleSetCardCounter = (counterId: number) => {
    onRequestSetCounter(counterId);
    onClose();
  };

  const handleDrawArrow = () => {
    onRequestDrawArrow();
    onClose();
  };

  const handleAttach = () => {
    onRequestAttach();
    onClose();
  };

  const handleUnattach = () => {
    if (!ready || gameId == null) {
      return;
    }
    // Unattach: omit target_* (server detects via proto2 presence).
    webClient.request.game.attachCard(gameId, { startZone: sourceZone!, cardId: card!.id }, judgeTargetId);
    onClose();
  };

  const handleMove = (target: MoveTarget) => {
    if (!ready || gameId == null) {
      return;
    }
    // dispatchBulkMove groups by (owner, zone) and routes each group: non-table
    // moves go to the card's owner tree; TABLE keeps the local player (a legal
    // cross-player control-change). See moveTargetPlayerId / bulkCardActions.
    webClient.request.game.bulkMove(gameId, actionTargets, {
      targetPlayerId: localPlayerId!,
      targetZone: target.zone,
      x: target.x,
      y: target.y,
    }, judgeTarget);
    onClose();
  };

  const handleMoveToLibraryAt = () => {
    onRequestMoveToLibraryAt();
    onClose();
  };

  const handlePlay = () => {
    if (!canPlay) {
      return;
    }
    onRequestPlay(false);
    onClose();
  };

  const handlePlayFaceDown = () => {
    if (!canPlay) {
      return;
    }
    onRequestPlay(true);
    onClose();
  };

  const handlePeek = () => {
    if (!ready || gameId == null) {
      return;
    }
    // actPeek reveals to local player only; scope via playerId.
    webClient.request.game.bulkPeek(gameId, actionTargets, localPlayerId!, judgeTarget);
    onClose();
  };

  return {
    ready,
    canActOnCard,
    canAttach,
    isAttached,
    canPlay,
    canPeek,
    moveTargets: CARD_MOVE_TARGETS,
    handleTapToggle,
    handleFaceDownToggle,
    handleDoesntUntapToggle,
    handleSetPT,
    handleSetAnnotation,
    handleCardCounterDelta,
    handleSetCardCounter,
    handleDrawArrow,
    handleAttach,
    handleUnattach,
    handlePlay,
    handlePlayFaceDown,
    handlePeek,
    handleMove,
    handleMoveToLibraryAt,
  };
}
