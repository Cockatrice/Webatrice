import { CardAttribute } from '@cockatrice/sockatrice/generated';
import type { useWebClient } from '@cockatrice/datatrice/react';

import type { SelectedCard } from './selection';

type GameWebClient = ReturnType<typeof useWebClient>;

export interface BulkMoveDestination {
  targetPlayerId: number;
  targetZone: string;
  x: number;
  y: number;
}

// Cockatrice collective tap rule (table_zone.cpp::toggleTapped): if any selected
// card is untapped, tap them all; otherwise untap them all.
export function dispatchBulkTap(
  webClient: GameWebClient,
  gameId: number,
  tableTargets: readonly SelectedCard[],
): void {
  if (tableTargets.length === 0) {
    return;
  }
  const tapAll = tableTargets.some((t) => !t.card.tapped);
  tableTargets.forEach((t) => {
    if (t.card.tapped === tapAll) {
      return;
    }
    webClient.request.game.setCardAttr(gameId, {
      zone: t.zone,
      cardId: t.card.id,
      attribute: CardAttribute.AttrTapped,
      attrValue: tapAll ? '1' : '0',
    });
  });
}

export function dispatchBulkMove(
  webClient: GameWebClient,
  gameId: number,
  targets: readonly SelectedCard[],
  dest: BulkMoveDestination,
): void {
  // One moveCard per (owner, zone) origin; the proto's ListOfCardsToMove carries the group.
  const groups = new Map<string, SelectedCard[]>();
  targets.forEach((t) => {
    const groupKey = `${t.ownerPlayerId}-${t.zone}`;
    const group = groups.get(groupKey);
    if (group) {
      group.push(t);
    } else {
      groups.set(groupKey, [t]);
    }
  });
  groups.forEach((group) => {
    webClient.request.game.moveCard(gameId, {
      startPlayerId: group[0].ownerPlayerId,
      startZone: group[0].zone,
      cardsToMove: { card: group.map((t) => ({ cardId: t.card.id })) },
      targetPlayerId: dest.targetPlayerId,
      targetZone: dest.targetZone,
      x: dest.x,
      y: dest.y,
      isReversed: false,
    });
  });
}
