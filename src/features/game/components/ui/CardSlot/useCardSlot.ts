import { useCallback, useId } from 'react';
import {
  useDraggable,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';

import type { Data } from '@app/types';

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
  card: Data.ServerInfo_Card;
  draggable: boolean;
  ownerPlayerId: number | undefined;
  zone: string | undefined;
}

export function useCardSlot({ card, draggable, ownerPlayerId, zone }: UseCardSlotArgs): CardSlot {
  const { smallUrl } = useScryfallCard(card);

  // React-stable id salts the dnd-kit IDs so even two disabled CardSlots
  // rendering the same card (during state transitions / hidden-zone leaks)
  // never collide.
  const instanceId = useId();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card-${ownerPlayerId ?? instanceId}-${zone ?? 'x'}-${card.id}`,
    data: { card, sourcePlayerId: ownerPlayerId, sourceZone: zone },
    disabled: !draggable || ownerPlayerId == null || zone == null,
  });

  // Cards are NOT drop targets. Drag-drop on a card falls through to the
  // BattlefieldRow's droppable and is resolved by grid math (stack/move) —
  // matches desktop where attach is right-click-menu-only via
  // CardItem::drawAttachArrow (cockatrice/src/game/board/card_item.cpp).

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
