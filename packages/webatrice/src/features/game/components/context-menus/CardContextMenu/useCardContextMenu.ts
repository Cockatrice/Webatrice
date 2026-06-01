import { useWebClient } from '@cockatrice/datatrice/react';
import { CardAttribute, ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { dispatchBulkMove, dispatchBulkTap } from '../../../utils/bulkCardActions';
import type { SelectedCard } from '../../../utils/selection';
interface MoveTarget {
  label: string;
  zone: string;
  x: number;
  y: number;
}

// Desktop 7-entry move menu. See .github/instructions/webatrice-game.instructions.md#dialog-parity.
export const CARD_MOVE_TARGETS: ReadonlyArray<MoveTarget> = [
  { label: 'Send to Hand', zone: Enriched.ZoneName.HAND, x: -1, y: 0 },
  { label: 'Send to Battlefield', zone: Enriched.ZoneName.TABLE, x: 0, y: 0 },
  { label: 'Send to Graveyard', zone: Enriched.ZoneName.GRAVE, x: 0, y: 0 },
  { label: 'Send to Exile', zone: Enriched.ZoneName.EXILE, x: 0, y: 0 },
  { label: 'Send to Library (top)', zone: Enriched.ZoneName.DECK, x: 0, y: 0 },
  { label: 'Send to Library (bottom)', zone: Enriched.ZoneName.DECK, x: -1, y: 0 },
];

export interface CardContextMenu {
  ready: boolean;
  isOwnedByLocal: boolean;
  canAttach: boolean;
  isAttached: boolean;
  canPlay: boolean;
  canPeek: boolean;
  moveTargets: ReadonlyArray<MoveTarget>;
  handleFlip: () => void;
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
  gameId: number;
  localPlayerId: number | null;
  card: ServerInfo_Card | null;
  ownerPlayerId: number | null;
  sourceZone: string | null;
  // The full multi-selection when the right-clicked card is part of it (size ≥ 2);
  // empty otherwise. Tap/Move act on the whole set when present.
  bulkTargets?: ReadonlyArray<SelectedCard>;
  onClose: () => void;
  onRequestSetPT: () => void;
  onRequestSetAnnotation: () => void;
  onRequestSetCounter: (counterId: number) => void;
  onRequestDrawArrow: () => void;
  onRequestAttach: () => void;
  onRequestPlay: (faceDown: boolean) => void;
  onRequestMoveToLibraryAt: () => void;
}

const EMPTY_BULK_TARGETS: ReadonlyArray<SelectedCard> = [];

export function useCardContextMenu({
  gameId,
  localPlayerId,
  card,
  ownerPlayerId,
  sourceZone,
  bulkTargets = EMPTY_BULK_TARGETS,
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

  const ready = card != null && ownerPlayerId != null && sourceZone != null && localPlayerId != null;

  // Card-menu affordance gates. See .github/instructions/webatrice-game.instructions.md#dialog-parity.
  const isOwnedByLocal = ready && ownerPlayerId === localPlayerId;
  const isAttached = ready && (card!.attachCardId ?? -1) >= 0;
  const canAttach = ready && sourceZone === Enriched.ZoneName.TABLE;
  const canPlay = ready && isOwnedByLocal && sourceZone !== Enriched.ZoneName.TABLE;
  const canPeek =
    ready && isOwnedByLocal && sourceZone === Enriched.ZoneName.TABLE && (card!.faceDown ?? false);

  const setAttr = (attribute: CardAttribute, value: string) => {
    if (!ready) {
      return;
    }
    webClient.request.game.setCardAttr(gameId, {
      zone: sourceZone!,
      cardId: card!.id,
      attribute,
      attrValue: value,
    });
  };

  const handleFlip = () => {
    if (!ready) {
      return;
    }
    // TODO(card-db): forward stored P/T once a name-keyed card DB is wired in (server re-derives for known names).
    webClient.request.game.flipCard(gameId, {
      zone: sourceZone!,
      cardId: card!.id,
      faceDown: !card!.faceDown,
    });
    onClose();
  };

  const handleTapToggle = () => {
    if (!ready) {
      return;
    }
    const tableTargets = bulkTargets.filter((t) => t.zone === Enriched.ZoneName.TABLE);
    if (tableTargets.length > 1) {
      dispatchBulkTap(webClient, gameId, tableTargets);
    } else {
      setAttr(CardAttribute.AttrTapped, card!.tapped ? '0' : '1');
    }
    onClose();
  };

  const handleFaceDownToggle = () => {
    if (!ready) {
      return;
    }
    setAttr(CardAttribute.AttrFaceDown, card!.faceDown ? '0' : '1');
    onClose();
  };

  const handleDoesntUntapToggle = () => {
    if (!ready) {
      return;
    }
    setAttr(CardAttribute.AttrDoesntUntap, card!.doesntUntap ? '0' : '1');
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
    if (!ready) {
      return;
    }
    webClient.request.game.incCardCounter(gameId, {
      zone: sourceZone!,
      cardId: card!.id,
      counterId,
      counterDelta: delta,
    });
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
    if (!ready) {
      return;
    }
    // Unattach: omit target_* (server detects via proto2 presence).
    webClient.request.game.attachCard(gameId, { startZone: sourceZone!, cardId: card!.id });
    onClose();
  };

  const handleMove = (target: MoveTarget) => {
    if (!ready) {
      return;
    }
    // targetPlayerId = local (acting player), per desktop actMoveCardTo*.
    if (bulkTargets.length > 1) {
      dispatchBulkMove(webClient, gameId, bulkTargets, {
        targetPlayerId: localPlayerId!,
        targetZone: target.zone,
        x: target.x,
        y: target.y,
      });
    } else {
      webClient.request.game.moveCard(gameId, {
        startPlayerId: ownerPlayerId!,
        startZone: sourceZone!,
        cardsToMove: { card: [{ cardId: card!.id }] },
        targetPlayerId: localPlayerId!,
        targetZone: target.zone,
        x: target.x,
        y: target.y,
        isReversed: false,
      });
    }
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
    if (!ready) {
      return;
    }
    // actPeek reveals to local player only; scope via playerId.
    webClient.request.game.revealCards(gameId, {
      zoneName: sourceZone!,
      cardId: [card!.id],
      playerId: localPlayerId!,
      topCards: -1,
    });
    onClose();
  };

  return {
    ready,
    isOwnedByLocal,
    canAttach,
    isAttached,
    canPlay,
    canPeek,
    moveTargets: CARD_MOVE_TARGETS,
    handleFlip,
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
