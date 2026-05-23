import { useDroppable } from '@dnd-kit/core';
import type { Ref } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

export interface HandZone {
  cards: ServerInfo_Card[];
  setNodeRef: Ref<HTMLDivElement>;
  isOver: boolean;
  handleZoneContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export interface UseHandZoneArgs {
  gameId: number;
  playerId: number;
  canAct: boolean;
  onZoneContextMenu?: (event: React.MouseEvent) => void;
}

export function useHandZone({
  gameId,
  playerId,
  canAct,
  onZoneContextMenu,
}: UseHandZoneArgs): HandZone {
  const cards = useAppSelector((state) =>
    games.Selectors.getCards(state, gameId, playerId, Enriched.ZoneName.HAND),
  );

  // Can't drop into someone else's hand; future-proofs opponent-hand mirrors.
  const { setNodeRef, isOver } = useDroppable({
    id: `hand-${playerId}`,
    data: { targetPlayerId: playerId, targetZone: Enriched.ZoneName.HAND },
    disabled: !canAct,
  });

  // Hand-area right-click opens the zone menu (card-level handler lives on CardSlot).
  const handleZoneContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onZoneContextMenu) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('[data-card-id]')) {
      return;
    }
    onZoneContextMenu(e);
  };

  return { cards, setNodeRef, isOver, handleZoneContextMenu };
}
