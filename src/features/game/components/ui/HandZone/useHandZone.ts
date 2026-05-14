import { useDroppable } from '@dnd-kit/core';
import type { Ref } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { ZoneName } from '@cockatrice/datatrice';
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
    games.Selectors.getCards(state, gameId, playerId, ZoneName.HAND),
  );

  // Match desktop: can't drop into a hand zone that isn't yours (judges
  // aside; server enforces the same restriction). Today only the local
  // HandZone mounts, but this guard future-proofs opponent-hand mirrors.
  const { setNodeRef, isOver } = useDroppable({
    id: `hand-${playerId}`,
    data: { targetPlayerId: playerId, targetZone: ZoneName.HAND },
    disabled: !canAct,
  });

  // Right-click anywhere inside the hand that doesn't land on a card opens
  // the hand zone context menu (mulligan / reveal hand). Card-level right-
  // click has its own handler on CardSlot.
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
