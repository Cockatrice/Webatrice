import { useCallback, useId } from 'react';
import {
  useDraggable,
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
  rootRef: (el: HTMLElement | null) => void;
}

export interface UseCardSlotArgs {
  card: ServerInfo_Card;
  draggable: boolean;
  ownerPlayerId: number | undefined;
  zone: string | undefined;
}

export function useCardSlot({ card, draggable, ownerPlayerId, zone }: UseCardSlotArgs): CardSlot {
  const { smallUrl } = useScryfallCard(card);

  // useId salt avoids dnd-kit id collisions across disabled-slot duplicates.
  const instanceId = useId();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card-${ownerPlayerId ?? instanceId}-${zone ?? 'x'}-${card.id}`,
    data: { card, sourcePlayerId: ownerPlayerId, sourceZone: zone },
    disabled: !draggable || ownerPlayerId == null || zone == null,
  });

  // Cards aren't drop targets; drops resolve at the row level.
  const registryKey =
    ownerPlayerId != null && zone != null
      ? makeCardKey(ownerPlayerId, zone, card.id)
      : null;
  const registerRef = useRegisterCardRef(registryKey);

  const rootRef = useCallback(
    (el: HTMLElement | null) => {
      registerRef(el);
      if (draggable) {
        setNodeRef(el);
      }
    },
    [registerRef, setNodeRef, draggable],
  );

  return {
    smallUrl,
    attributes,
    listeners,
    isDragging,
    rootRef,
  };
}
