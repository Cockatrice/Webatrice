import { useCallback, useId } from 'react';
import {
  useDraggable,
  useDroppable,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { useScryfallCard } from '../../../hooks/useScryfallCard';
import { makeCardKey, useRegisterCardRef } from '../../../utils/CardRegistry/CardRegistryContext';

export interface CardSlot {
  smallUrl: string | null | undefined;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
  dropSide: 'before' | 'after' | null;
  rootRef: (el: HTMLElement | null) => void;
}

export interface UseCardSlotArgs {
  card: ServerInfo_Card;
  draggable: boolean;
  ownerPlayerId: number | undefined;
  zone: string | undefined;
  dropIndex?: number;
}

export function useCardSlot({ card, draggable, ownerPlayerId, zone, dropIndex }: UseCardSlotArgs): CardSlot {
  const { smallUrl } = useScryfallCard(card);

  // useId salt avoids dnd-kit id collisions across disabled-slot duplicates.
  const instanceId = useId();

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `card-${ownerPlayerId ?? instanceId}-${zone ?? 'x'}-${card.id}`,
    data: { card, sourcePlayerId: ownerPlayerId, sourceZone: zone, sourceIndex: dropIndex },
    disabled: !draggable || ownerPlayerId == null || zone == null,
  });

  const droppableEnabled =
    dropIndex != null && ownerPlayerId != null && zone != null && !isDragging;
  const { setNodeRef: setDropRef, isOver, active } = useDroppable({
    id: `slot-${ownerPlayerId ?? instanceId}-${zone ?? 'x'}-${card.id}`,
    data: {
      targetPlayerId: ownerPlayerId,
      targetZone: zone,
      targetIndex: dropIndex,
      asReorderSlot: true,
    },
    disabled: !droppableEnabled,
  });

  // Same-zone reorder hover: indicator side derives from sourceIndex vs
  // dropIndex. wire x is the post-removal index; when source < target the
  // target shifts left and the dragged card lands on its after-edge, when
  // source > target the target stays put and the dragged card lands before.
  let dropSide: 'before' | 'after' | null = null;
  if (droppableEnabled && isOver && dropIndex != null && active) {
    const sourceData = active.data.current as
      | { sourcePlayerId?: number; sourceZone?: string; sourceIndex?: number }
      | undefined;
    if (
      sourceData?.sourceZone === zone &&
      sourceData.sourcePlayerId === ownerPlayerId &&
      sourceData.sourceIndex != null
    ) {
      dropSide = sourceData.sourceIndex < dropIndex ? 'after' : 'before';
    }
  }

  const registryKey =
    ownerPlayerId != null && zone != null
      ? makeCardKey(ownerPlayerId, zone, card.id)
      : null;
  const registerRef = useRegisterCardRef(registryKey);

  const rootRef = useCallback(
    (el: HTMLElement | null) => {
      registerRef(el);
      if (draggable) {
        setDragRef(el);
      }
      if (droppableEnabled) {
        setDropRef(el);
      }
    },
    [registerRef, setDragRef, draggable, setDropRef, droppableEnabled],
  );

  return {
    smallUrl,
    attributes,
    listeners,
    isDragging,
    dropSide,
    rootRef,
  };
}
