import { useCallback, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

import { useWebClient } from '@cockatrice/datatrice/react';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import {
  MARGIN_LEFT_PX,
  PADDING_X_PX,
  closestGridPoint,
  effectiveCardDimensions,
  mapToGridX,
  stackCountsForRow,
} from '../components/battlefield/Battlefield/gridMath';

export interface GameDnd {
  activeCard: ServerInfo_Card | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export interface UseGameDndArgs {
  gameId: number | undefined;
  onDragStart: () => void;
}

// Drop point = card center at release (matches desktop scene position).
function computePointerXInRow(event: DragEndEvent): number {
  const overRect = event.over?.rect;
  const activeRect = event.active.rect.current.translated;
  if (!overRect || !activeRect) {
    return 0;
  }
  const cardCenterX = activeRect.left + activeRect.width / 2;
  return cardCenterX - overRect.left - MARGIN_LEFT_PX;
}

export function useGameDnd({ gameId, onDragStart }: UseGameDndArgs): GameDnd {
  const webClient = useWebClient();
  const [activeCard, setActiveCard] = useState<ServerInfo_Card | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as
        | { card: ServerInfo_Card }
        | undefined;
      setActiveCard(data?.card ?? null);
      // Drag start cancels any armed pending-arrow / pending-attach.
      onDragStart();
    },
    [onDragStart],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);
      if (!gameId || !event.over || !event.active.data.current) {
        return;
      }
      const source = event.active.data.current as {
        card: ServerInfo_Card;
        sourcePlayerId: number;
        sourceZone: string;
      };
      const target = event.over.data.current as {
        targetPlayerId: number;
        targetZone: string;
        row?: number;
        rowCards?: ServerInfo_Card[];
      };

      // Drag-drop never attaches; desktop attaches via right-click menu only.
      const sameZone =
        source.sourcePlayerId === target.targetPlayerId &&
        source.sourceZone === target.targetZone;
      // Non-TABLE same-zone drops are no-ops.
      if (sameZone && source.sourceZone !== Enriched.ZoneName.TABLE) {
        return;
      }

      const targetRow = target.row ?? 0;
      const targetIsTable = target.targetZone === Enriched.ZoneName.TABLE;
      const sameRowOnTable =
        sameZone && source.sourceZone === Enriched.ZoneName.TABLE && (source.card.y ?? 0) === targetRow;

      // gridX via stack/subposition packing; non-TABLE → x=0. See .github/instructions/webatrice-game.instructions.md#battlefield-grid.
      let gridX = 0;
      if (targetIsTable) {
        const rowCards = target.rowCards ?? [];
        // Same-row reorder: exclude the dragged card from occupancy so closestGridPoint can return its own slot.
        const neighbors = sameRowOnTable
          ? rowCards.filter((c) => c.id !== source.card.id)
          : rowCards;
        const pointerXInRow = computePointerXInRow(event);
        const stackCounts = stackCountsForRow(neighbors);
        // Effective card width derived from laneHeight so grid math tracks zoom (cards render via CSS aspect-ratio).
        const { width: effectiveCardWidth, offsetX: effectiveOffsetX } =
          effectiveCardDimensions(event.over.rect.height);
        const rawGridX = mapToGridX(
          pointerXInRow,
          stackCounts,
          effectiveCardWidth,
          effectiveOffsetX,
          PADDING_X_PX,
        );
        const occupied = new Set(neighbors.map((c) => c.x ?? 0));
        const resolved = closestGridPoint(rawGridX, occupied);
        // Fully-occupied stack: silent reject. See .github/instructions/webatrice-game.instructions.md#battlefield-grid.
        if (resolved == null) {
          return;
        }
        gridX = resolved;
      }

      // targetRow is already the logical wire y; no re-inversion here.
      // See .github/instructions/webatrice-game.instructions.md#battlefield-grid.
      webClient.request.game.moveCard(gameId, {
        startPlayerId: source.sourcePlayerId,
        startZone: source.sourceZone,
        cardsToMove: { card: [{ cardId: source.card.id }] },
        targetPlayerId: target.targetPlayerId,
        targetZone: target.targetZone,
        x: gridX,
        y: targetIsTable ? targetRow : 0,
        isReversed: false,
      });
    },
    [gameId, webClient],
  );

  const handleDragCancel = useCallback(() => {
    setActiveCard(null);
  }, []);

  return { activeCard, handleDragStart, handleDragEnd, handleDragCancel };
}
