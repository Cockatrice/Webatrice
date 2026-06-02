import { useCallback } from 'react';
import { pointerWithin, rectIntersection } from '@dnd-kit/core';
import type {
  Collision,
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
  DroppableContainer,
} from '@dnd-kit/core';

import { useWebClient } from '@cockatrice/datatrice/react';
import type { WebClient } from '@cockatrice/sockatrice';
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
import { moveTargetPlayerId } from '../utils/moveTarget';

export interface GameDnd {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  collisionDetection: CollisionDetection;
}

export interface UseGameDndArgs {
  gameId: number | undefined;
  // Resolves the Command_Judge target for a dragged card's owner (the owner when a
  // judge drags a foreign card, else undefined → bare). Passed in to keep this hook
  // store-decoupled. See useJudgeTarget.
  judgeTarget: (ownerPlayerId: number) => number | undefined;
  cancelPendingArrow: () => void;
  collapseUnlessSelected: (
    ownerPlayerId: number | undefined,
    zone: string | undefined,
    card: ServerInfo_Card,
  ) => void;
}

// Reorder slots (small per-card droppables) are nested inside a much larger
// zone-level droppable. Default rectIntersection's IoU ratio favors the zone
// when the overlay outsizes a slot (e.g. 64x88 stack slots under a 146x204
// overlay), so the slot never wins. Prefer reorder-slot collisions whenever
// they exist; otherwise fall back to the full intersection set.
function slotIntersection(
  args: Parameters<CollisionDetection>[0],
  intersections: Collision[],
): Collision[] {
  return intersections.filter((c) =>
    args.droppableContainers.find((d) => d.id === c.id)?.data.current?.asReorderSlot === true,
  );
}

// A droppable lives "in a popup" when its node is inside a floating
// ZoneViewDialog (position:fixed, z-index:1200 — see ZoneViewDialog.css). Such a
// popup is visually stacked above the board, but dnd-kit collision is purely
// geometric: board droppables rendered underneath a popup would otherwise
// compete with — and beat — the popup's own droppables (its body + the reorder
// slots of the cards it renders).
function isInPopup(container: DroppableContainer | undefined): boolean {
  return !!container?.node.current?.closest('.zone-view-dialog');
}

// Scope collisions to the layer the pointer is actually over so drops respect a
// popup's z-order. If the pointer is within an open popup, only that popup's
// droppables are eligible (a board card dropped onto the popup routes into the
// popup's zone); otherwise popup droppables are excluded and the board/hand/
// stack droppables win (a card dropped on visible board lands there even if a
// popup overlaps elsewhere on screen).
//
// Limitation: with multiple overlapping popups open at once the scoped set spans
// every popup under the pointer rather than only the topmost. Acceptable today —
// the flows close each popup before opening the next.
function scopeToPointerLayer(
  args: Parameters<CollisionDetection>[0],
): Parameters<CollisionDetection>[0] {
  const overPopup = pointerWithin(args).some((c) =>
    isInPopup(args.droppableContainers.find((d) => d.id === c.id)),
  );
  const droppableContainers = args.droppableContainers.filter((c) => isInPopup(c) === overPopup);
  return { ...args, droppableContainers };
}

const collisionDetection: CollisionDetection = (args) => {
  const scoped = scopeToPointerLayer(args);
  const intersections = rectIntersection(scoped);
  const slotHits = slotIntersection(scoped, intersections);
  return slotHits.length > 0 ? slotHits : intersections;
};

interface DragSource {
  card: ServerInfo_Card;
  sourcePlayerId: number;
  sourceZone: string;
  sourceIndex?: number;
}

interface DragTarget {
  targetPlayerId: number;
  targetZone: string;
  row?: number;
  rowCards?: ServerInfo_Card[];
  targetIndex?: number;
  asReorderSlot?: boolean;
}

type DropContext =
  | { kind: 'reorder'; source: DragSource; target: DragTarget; targetIndex: number }
  | { kind: 'table'; source: DragSource; target: DragTarget; targetRow: number; sameRow: boolean }
  | { kind: 'cross-zone'; source: DragSource; target: DragTarget }
  | { kind: 'noop' };

function classifyDrop(event: DragEndEvent): DropContext {
  if (!event.over || !event.active.data.current) {
    return { kind: 'noop' };
  }
  const source = event.active.data.current as DragSource;
  const target = event.over.data.current as DragTarget;

  const sameZone =
    source.sourcePlayerId === target.targetPlayerId &&
    source.sourceZone === target.targetZone;

  // Any same-zone drop onto a per-card reorder slot is a reorder (hand, stack,
  // and zone-view popups like library/grave/exile). Table cards aren't reorder
  // slots, so table reorders fall through to the grid path below.
  if (sameZone && target.asReorderSlot && target.targetIndex != null) {
    if (source.sourceIndex === target.targetIndex) {
      return { kind: 'noop' };
    }
    return { kind: 'reorder', source, target, targetIndex: target.targetIndex };
  }

  if (target.targetZone === Enriched.ZoneName.TABLE) {
    const targetRow = target.row ?? 0;
    const sameRow =
      sameZone &&
      source.sourceZone === Enriched.ZoneName.TABLE &&
      (source.card.y ?? 0) === targetRow;
    return { kind: 'table', source, target, targetRow, sameRow };
  }

  if (sameZone) {
    // Same-zone drops that didn't hit a reorder slot are no-ops; the TABLE case
    // above already routed table reorders.
    return { kind: 'noop' };
  }

  // Cross-zone here is always a non-table destination (TABLE handled above), so
  // the move routes to the card's owner tree (see moveTargetPlayerId).
  return {
    kind: 'cross-zone',
    source,
    target: {
      ...target,
      targetPlayerId: moveTargetPlayerId(source.sourcePlayerId, target.targetZone, target.targetPlayerId),
    },
  };
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

// Battlefield grid math; see .github/instructions/webatrice-game.instructions.md#battlefield-grid.
function resolveTableGridX(
  event: DragEndEvent,
  source: DragSource,
  target: DragTarget,
  sameRow: boolean,
): number | null {
  const rowCards = target.rowCards ?? [];
  // Same-row reorder: exclude the dragged card from occupancy so closestGridPoint can return its own slot.
  const neighbors = sameRow ? rowCards.filter((c) => c.id !== source.card.id) : rowCards;
  const pointerXInRow = computePointerXInRow(event);
  const stackCounts = stackCountsForRow(neighbors);
  // Effective card width derived from laneHeight so grid math tracks zoom (cards render via CSS aspect-ratio).
  const overRect = event.over?.rect;
  const { width: effectiveCardWidth, offsetX: effectiveOffsetX } =
    effectiveCardDimensions(overRect?.height ?? 0);
  const rawGridX = mapToGridX(
    pointerXInRow,
    stackCounts,
    effectiveCardWidth,
    effectiveOffsetX,
    PADDING_X_PX,
  );
  const occupied = new Set(neighbors.map((c) => c.x ?? 0));
  return closestGridPoint(rawGridX, occupied);
}

function sendMoveCard(
  webClient: WebClient,
  gameId: number,
  source: DragSource,
  target: DragTarget,
  x: number,
  y: number,
  judgeTargetId?: number,
): void {
  webClient.request.game.moveCard(gameId, {
    startPlayerId: source.sourcePlayerId,
    startZone: source.sourceZone,
    cardsToMove: { card: [{ cardId: source.card.id }] },
    targetPlayerId: target.targetPlayerId,
    targetZone: target.targetZone,
    x,
    y,
    isReversed: false,
  }, judgeTargetId);
}

export function useGameDnd({
  gameId,
  judgeTarget,
  cancelPendingArrow,
  collapseUnlessSelected,
}: UseGameDndArgs): GameDnd {
  const webClient = useWebClient();

  // Cancel any pending arrow, then collapse the selection to the dragged card
  // unless it's already part of it (so a drag on a selected card keeps the set).
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      cancelPendingArrow();
      const source = event.active.data.current as DragSource | undefined;
      if (source?.card) {
        collapseUnlessSelected(source.sourcePlayerId, source.sourceZone, source.card);
      }
    },
    [cancelPendingArrow, collapseUnlessSelected],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!gameId) {
        return;
      }
      const ctx = classifyDrop(event);
      if (ctx.kind === 'noop') {
        return;
      }
      const judgeTargetId = judgeTarget(ctx.source.sourcePlayerId);
      switch (ctx.kind) {
        case 'reorder':
          sendMoveCard(webClient, gameId, ctx.source, ctx.target, ctx.targetIndex, 0, judgeTargetId);
          return;
        case 'table': {
          const gridX = resolveTableGridX(event, ctx.source, ctx.target, ctx.sameRow);
          // Fully-occupied stack: silent reject.
          if (gridX == null) {
            return;
          }
          sendMoveCard(webClient, gameId, ctx.source, ctx.target, gridX, ctx.targetRow, judgeTargetId);
          return;
        }
        case 'cross-zone':
          sendMoveCard(webClient, gameId, ctx.source, ctx.target, 0, 0, judgeTargetId);
          return;
      }
    },
    [gameId, webClient, judgeTarget],
  );

  return { handleDragStart, handleDragEnd, collisionDetection };
}
