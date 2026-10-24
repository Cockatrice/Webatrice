import { useCallback, useEffect, useState } from 'react';
import { pointerWithin } from '@dnd-kit/core';
import type { Collision, CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';

import { useWebClient } from '@cockatrice/datatrice/react';
import { type MoveCardParams } from '@cockatrice/sockatrice/generated';
import {
  isSeatDragSource,
  isSeatDropZone,
  planSeatMove,
  seatDropAccepts,
  type SeatDragSource,
  type SeatDropTarget,
} from './seatDropPlan';
import { seatDropPointOf } from '../components/ui/SeatDragContext';

export interface GameDnd {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
  collisionDetection: CollisionDetection;
  activeSeatDrag: SeatDragSource | null;
  moveSeatCards: (source: SeatDragSource, target: SeatDropTarget) => void;
}

export interface UseGameDndArgs {
  gameId: number | undefined;
  // Resolves the Command_Judge target for a dragged card's owner (the owner when a
  // judge drags a foreign card, else undefined → bare). Passed in to keep this hook
  // store-decoupled. See useJudgeTarget.
  judgeTarget: (ownerPlayerId: number) => number | undefined;
  isJudge?: boolean;
  cancelPendingArrow: () => void;
  clearSelection?: () => void;
  moveCard?: (params: MoveCardParams) => void;
}

function seatCollision(args: Parameters<CollisionDetection>[0], source: SeatDragSource): Collision[] {
  const pointer = args.pointerCoordinates;
  const doc = args.droppableContainers.find((c) => c.node.current)?.node.current?.ownerDocument;
  if (pointer && doc?.elementsFromPoint) {
    const hits = pointerWithin(args);
    for (const element of doc.elementsFromPoint(pointer.x, pointer.y)) {
      const front = args.droppableContainers.find((container) =>
        isSeatDropZone(container.data.current) &&
        hits.some((hit) => hit.id === container.id) &&
        container.node.current?.contains(element),
      );
      if (front) {
        const zone = front.data.current;
        return isSeatDropZone(zone) && seatDropAccepts(zone, source)
          ? hits.filter((hit) => hit.id === front.id)
          : [];
      }
    }
    return [];
  }
  const accepting = args.droppableContainers.filter((container) => {
    const zone = container.data.current;
    return isSeatDropZone(zone) && seatDropAccepts(zone, source);
  });
  const priorityOf = (id: Collision['id']) => {
    const zone = accepting.find((c) => c.id === id)?.data.current;
    return isSeatDropZone(zone) ? zone.priority : 0;
  };
  return pointerWithin({ ...args, droppableContainers: accepting })
    .sort((a, b) => priorityOf(b.id) - priorityOf(a.id));
}

const collisionDetection: CollisionDetection = (args) => {
  const source = args.active.data?.current;
  return isSeatDragSource(source) ? seatCollision(args, source) : [];
};

function useGrabbingCursor(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { cursor: grabbing !important; }';
    document.head.appendChild(style);
    return () => {
      document.body.style.cursor = previous;
      style.remove();
    };
  }, [active]);
}

export function useGameDnd({
  gameId,
  judgeTarget,
  isJudge = false,
  cancelPendingArrow,
  clearSelection,
  moveCard,
}: UseGameDndArgs): GameDnd {
  const webClient = useWebClient();
  const [activeSeatDrag, setActiveSeatDrag] = useState<SeatDragSource | null>(null);
  useGrabbingCursor(activeSeatDrag !== null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      cancelPendingArrow();
      const data = event.active.data.current;
      if (isSeatDragSource(data)) {
        setActiveSeatDrag({ ...data });
      }
    },
    [cancelPendingArrow],
  );

  const moveSeatCards = useCallback(
    (source: SeatDragSource, target: SeatDropTarget) => {
      if (moveCard && gameId) {
        for (const params of planSeatMove(source, target, { judge: isJudge })) {
          const judgeTargetId = source.lenderPlayerId == null ? judgeTarget(params.startPlayerId) : undefined;
          if (judgeTargetId != null) {
            webClient.request.game.moveCard(gameId, params, judgeTargetId);
          } else {
            moveCard(params);
          }
        }
      }
      clearSelection?.();
    },
    [gameId, webClient, moveCard, clearSelection, judgeTarget, isJudge],
  );

  const handleSeatDragEnd = useCallback(
    (event: DragEndEvent, source: SeatDragSource) => {
      setActiveSeatDrag(null);
      const zone = event.over?.data.current;
      const target = isSeatDropZone(zone) ? zone.resolve(seatDropPointOf(event), source) : null;
      if (target) {
        moveSeatCards(source, target);
      } else {
        clearSelection?.();
      }
    },
    [moveSeatCards, clearSelection],
  );

  const handleDragCancel = useCallback(() => setActiveSeatDrag(null), []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const seatSource = event.active.data.current;
      if (isSeatDragSource(seatSource)) {
        handleSeatDragEnd(event, { ...seatSource });
      }
    },
    [handleSeatDragEnd],
  );

  return { handleDragStart, handleDragEnd, handleDragCancel, collisionDetection, activeSeatDrag, moveSeatCards };
}
