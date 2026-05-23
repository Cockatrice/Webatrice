import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSettings } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';
import { CardAttribute, ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched, GameEntry } from '@cockatrice/datatrice';
import { ArrowColor, ColorRGBA, rgbaToCss } from '@app/types';
import { makeCardKey, type CardRegistry } from '../utils/CardRegistry/CardRegistryContext';

import { playCardViaTableRow } from './playCard';

interface PendingArrow {
  sourcePlayerId: number;
  sourceZone: string;
  sourceCardId: number;
}

// Distinct from PendingArrow so attach-only fields can diverge later.
interface PendingAttach {
  sourcePlayerId: number;
  sourceZone: string;
  sourceCardId: number;
}

interface ArrowDragState {
  sourcePlayerId: number;
  sourceZone: string;
  sourceCardId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
}

export interface ArrowDragPreview {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface GameArrowInteractions {
  arrowSourceKey: string | null;
  dragPreview: ArrowDragPreview | null;
  handleBoardMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleCardClick: (
    ownerPlayerId: number,
    zone: string,
    card: ServerInfo_Card,
  ) => void;
  handleCardDoubleClick: (sourceZone: string, card: ServerInfo_Card) => void;
  startPendingArrow: (source: PendingArrow) => void;
  startPendingAttach: (source: PendingAttach) => void;
  cancelPendingOnDragStart: () => void;
}

export interface UseGameArrowInteractionsArgs {
  gameId: number | undefined;
  game: GameEntry | undefined;
  boardRef: RefObject<HTMLDivElement>;
  cardRegistry: CardRegistry;
}

function arrowColorForModifiers(e: {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): ColorRGBA {
  if (e.ctrlKey) {
    return ArrowColor.YELLOW;
  }
  if (e.altKey) {
    return ArrowColor.BLUE;
  }
  if (e.shiftKey) {
    return ArrowColor.GREEN;
  }
  return ArrowColor.RED;
}

const ARROW_DRAG_THRESHOLD_PX = 8;

export function useGameArrowInteractions({
  gameId,
  game,
  boardRef,
  cardRegistry,
}: UseGameArrowInteractionsArgs): GameArrowInteractions {
  const webClient = useWebClient();
  const { value: settings } = useSettings();
  const invertVerticalCoordinate = settings?.invertVerticalCoordinate ?? false;

  const [pendingArrow, setPendingArrow] = useState<PendingArrow | null>(null);
  const [pendingAttach, setPendingAttach] = useState<PendingAttach | null>(null);
  const [arrowDrag, setArrowDrag] = useState<ArrowDragState | null>(null);
  const suppressNextContextMenuRef = useRef(false);

  // ESC cancels pending arrow/attach unless a MUI dialog has it first.
  useEffect(() => {
    if (!pendingArrow && !pendingAttach && !arrowDrag) {
      return undefined;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      if (document.querySelector('.MuiDialog-root[role="dialog"]')) {
        return;
      }
      setPendingArrow(null);
      setPendingAttach(null);
      setArrowDrag(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingArrow, pendingAttach, arrowDrag]);

  // Right-click-drag arrow lifecycle: window mousemove + mouseup.
  useEffect(() => {
    if (!arrowDrag) {
      return undefined;
    }

    const handleMove = (e: MouseEvent) => {
      setArrowDrag((prev) => {
        if (!prev) {
          return prev;
        }
        const movedX = Math.abs(e.clientX - prev.startX);
        const movedY = Math.abs(e.clientY - prev.startY);
        const moved = prev.moved || movedX + movedY > ARROW_DRAG_THRESHOLD_PX;
        return { ...prev, currentX: e.clientX, currentY: e.clientY, moved };
      });
    };

    const handleUp = (e: MouseEvent) => {
      if (e.button !== 2) {
        return;
      }
      const drag = arrowDrag;
      if (!drag) {
        return;
      }
      const movedX = Math.abs(e.clientX - drag.startX);
      const movedY = Math.abs(e.clientY - drag.startY);
      const moved = drag.moved || movedX + movedY > ARROW_DRAG_THRESHOLD_PX;
      setArrowDrag(null);
      if (!moved || gameId == null) {
        // Short right-click with no drag: let the contextmenu handler run
        // (it will open the card menu).
        return;
      }
      // Any real drag suppresses the contextmenu event that follows mouseup.
      suppressNextContextMenuRef.current = true;

      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-card-id]') as HTMLElement | null;
      if (!el) {
        return;
      }
      const targetPlayerId = Number(el.getAttribute('data-card-owner'));
      const targetZone = el.getAttribute('data-card-zone') ?? '';
      const targetCardId = Number(el.getAttribute('data-card-id'));
      if (!Number.isFinite(targetPlayerId) || !targetZone || !Number.isFinite(targetCardId)) {
        return;
      }
      // Same-card drops are cancellations.
      if (
        targetPlayerId === drag.sourcePlayerId &&
        targetZone === drag.sourceZone &&
        targetCardId === drag.sourceCardId
      ) {
        return;
      }
      // Local-hand arrow → non-hand auto-plays the card.
      // See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
      if (
        drag.sourceZone === Enriched.ZoneName.HAND &&
        drag.sourcePlayerId === game?.localPlayerId &&
        targetZone !== Enriched.ZoneName.HAND
      ) {
        webClient.request.game.moveCard(gameId, {
          startPlayerId: drag.sourcePlayerId,
          startZone: drag.sourceZone,
          cardsToMove: { card: [{ cardId: drag.sourceCardId }] },
          targetPlayerId: drag.sourcePlayerId,
          targetZone: Enriched.ZoneName.TABLE,
          x: 0,
          y: 0,
          isReversed: false,
        });
        return;
      }
      webClient.request.game.createArrow(gameId, {
        startPlayerId: drag.sourcePlayerId,
        startZone: drag.sourceZone,
        startCardId: drag.sourceCardId,
        targetPlayerId,
        targetZone,
        targetCardId,
        arrowColor: arrowColorForModifiers(e),
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [arrowDrag, gameId, webClient, game?.localPlayerId]);

  // Suppress the browser contextmenu event after a right-drag.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suppressNextContextMenuRef.current) {
        e.preventDefault();
        suppressNextContextMenuRef.current = false;
      }
    };
    window.addEventListener('contextmenu', handler);
    return () => window.removeEventListener('contextmenu', handler);
  }, []);

  const handleBoardMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2) {
      return;
    }
    const el = (e.target as HTMLElement).closest('[data-card-id]') as HTMLElement | null;
    if (!el) {
      return;
    }
    const sourcePlayerId = Number(el.getAttribute('data-card-owner'));
    const sourceZone = el.getAttribute('data-card-zone') ?? '';
    const sourceCardId = Number(el.getAttribute('data-card-id'));
    if (!Number.isFinite(sourcePlayerId) || !sourceZone || !Number.isFinite(sourceCardId)) {
      return;
    }
    setArrowDrag({
      sourcePlayerId,
      sourceZone,
      sourceCardId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      moved: false,
    });
  }, []);

  const arrowSourceKey = pendingArrow
    ? makeCardKey(pendingArrow.sourcePlayerId, pendingArrow.sourceZone, pendingArrow.sourceCardId)
    : pendingAttach
      ? makeCardKey(pendingAttach.sourcePlayerId, pendingAttach.sourceZone, pendingAttach.sourceCardId)
      : arrowDrag
        ? makeCardKey(arrowDrag.sourcePlayerId, arrowDrag.sourceZone, arrowDrag.sourceCardId)
        : null;

  // viewport → board-relative coords for the SVG preview line.
  const dragPreview = useMemo<ArrowDragPreview | null>(() => {
    if (!arrowDrag || !arrowDrag.moved) {
      return null;
    }
    const boardRect = boardRef.current?.getBoundingClientRect();
    const sourceEl = cardRegistry.get(
      makeCardKey(arrowDrag.sourcePlayerId, arrowDrag.sourceZone, arrowDrag.sourceCardId),
    );
    if (!boardRect || !sourceEl) {
      return null;
    }
    const sourceRect = sourceEl.getBoundingClientRect();
    return {
      x1: sourceRect.left + sourceRect.width / 2 - boardRect.left,
      y1: sourceRect.top + sourceRect.height / 2 - boardRect.top,
      x2: arrowDrag.currentX - boardRect.left,
      y2: arrowDrag.currentY - boardRect.top,
      color: rgbaToCss(ArrowColor.RED),
    };
  }, [arrowDrag, cardRegistry, boardRef]);

  const handleCardClick = useCallback(
    (ownerPlayerId: number, zone: string, card: ServerInfo_Card) => {
      if (gameId == null) {
        return;
      }

      // Pending-attach takes precedence over pending-arrow (later menu action wins).
      if (pendingAttach) {
        if (
          pendingAttach.sourcePlayerId === ownerPlayerId &&
          pendingAttach.sourceZone === zone &&
          pendingAttach.sourceCardId === card.id
        ) {
          setPendingAttach(null);
          return;
        }
        webClient.request.game.attachCard(gameId, {
          startZone: pendingAttach.sourceZone,
          cardId: pendingAttach.sourceCardId,
          targetPlayerId: ownerPlayerId,
          targetZone: zone,
          targetCardId: card.id,
        });
        setPendingAttach(null);
        return;
      }

      if (!pendingArrow) {
        return;
      }
      // Cancel if user re-clicks the pending source.
      if (
        pendingArrow.sourcePlayerId === ownerPlayerId &&
        pendingArrow.sourceZone === zone &&
        pendingArrow.sourceCardId === card.id
      ) {
        setPendingArrow(null);
        return;
      }
      // Local-hand arrow → non-hand auto-plays the card.
      // See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
      if (
        pendingArrow.sourceZone === Enriched.ZoneName.HAND &&
        pendingArrow.sourcePlayerId === game?.localPlayerId &&
        zone !== Enriched.ZoneName.HAND
      ) {
        webClient.request.game.moveCard(gameId, {
          startPlayerId: pendingArrow.sourcePlayerId,
          startZone: pendingArrow.sourceZone,
          cardsToMove: { card: [{ cardId: pendingArrow.sourceCardId }] },
          targetPlayerId: pendingArrow.sourcePlayerId,
          targetZone: Enriched.ZoneName.TABLE,
          x: 0,
          y: 0,
          isReversed: false,
        });
        setPendingArrow(null);
        return;
      }
      webClient.request.game.createArrow(gameId, {
        startPlayerId: pendingArrow.sourcePlayerId,
        startZone: pendingArrow.sourceZone,
        startCardId: pendingArrow.sourceCardId,
        targetPlayerId: ownerPlayerId,
        targetZone: zone,
        targetCardId: card.id,
        arrowColor: ArrowColor.RED,
      });
      setPendingArrow(null);
    },
    [gameId, game?.localPlayerId, pendingArrow, pendingAttach, webClient],
  );

  const handleCardDoubleClick = useCallback(
    (sourceZone: string, card: ServerInfo_Card) => {
      if (gameId == null) {
        return;
      }
      // Pending arrow/attach owns the pointer; skip double-click.
      if (pendingArrow || pendingAttach) {
        return;
      }
      if (sourceZone === Enriched.ZoneName.TABLE) {
        webClient.request.game.setCardAttr(gameId, {
          zone: sourceZone,
          cardId: card.id,
          attribute: CardAttribute.AttrTapped,
          attrValue: card.tapped ? '0' : '1',
        });
        return;
      }
      if (sourceZone === Enriched.ZoneName.HAND && game?.localPlayerId != null) {
        const localPlayerId = game.localPlayerId;
        // Local target is never per-player mirrored; honor invertVerticalCoordinate for wire y.
        void playCardViaTableRow({
          webClient,
          gameId,
          localPlayerId,
          sourcePlayerId: localPlayerId,
          sourceZone: Enriched.ZoneName.HAND,
          card,
          faceDown: false,
          isInverted: invertVerticalCoordinate,
          tableZone: game.players[localPlayerId]?.zones[Enriched.ZoneName.TABLE],
        });
      }
    },
    [gameId, game, invertVerticalCoordinate, pendingArrow, pendingAttach, webClient],
  );

  const startPendingArrow = useCallback((source: PendingArrow) => {
    setPendingArrow(source);
  }, []);

  const startPendingAttach = useCallback((source: PendingAttach) => {
    setPendingAttach(source);
  }, []);

  const cancelPendingOnDragStart = useCallback(() => {
    setPendingArrow((prev) => (prev ? null : prev));
    setPendingAttach((prev) => (prev ? null : prev));
  }, []);

  return {
    arrowSourceKey,
    dragPreview,
    handleBoardMouseDown,
    handleCardClick,
    handleCardDoubleClick,
    startPendingArrow,
    startPendingAttach,
    cancelPendingOnDragStart,
  };
}
