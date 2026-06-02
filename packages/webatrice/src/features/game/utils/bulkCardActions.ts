import { CardAttribute } from '@cockatrice/sockatrice/generated';
import type { useWebClient } from '@cockatrice/datatrice/react';

import type { SelectedCard } from './selection';
import { moveTargetPlayerId } from './moveTarget';

type GameWebClient = ReturnType<typeof useWebClient>;

// Resolves the Command_Judge target for a card owner (the owner when a judge acts
// on a foreign card, else undefined). See useJudgeTarget. Defaults to no wrapping.
type JudgeTarget = (ownerPlayerId: number) => number | undefined;
const NO_JUDGE: JudgeTarget = () => undefined;

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
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (tableTargets.length === 0) {
    return;
  }
  const tapAll = tableTargets.some((t) => !t.card.tapped);
  tableTargets.forEach((t) => {
    if (t.card.tapped === tapAll) {
      return;
    }
    // A judge tapping a foreign card wraps it as that card's owner; own cards send bare.
    webClient.request.game.setCardAttr(gameId, {
      zone: t.zone,
      cardId: t.card.id,
      attribute: CardAttribute.AttrTapped,
      attrValue: tapAll ? '1' : '0',
    }, judgeTarget(t.ownerPlayerId));
  });
}

export function dispatchBulkMove(
  webClient: GameWebClient,
  gameId: number,
  targets: readonly SelectedCard[],
  dest: BulkMoveDestination,
  judgeTarget: JudgeTarget = NO_JUDGE,
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
  // Non-table moves route to each group's own owner tree; TABLE keeps
  // dest.targetPlayerId (a legal cross-player control-change). See moveTargetPlayerId.
  groups.forEach((group) => {
    // A judge moving a foreign group wraps it as that group's owner. See useJudgeTarget.
    webClient.request.game.moveCard(gameId, {
      startPlayerId: group[0].ownerPlayerId,
      startZone: group[0].zone,
      cardsToMove: { card: group.map((t) => ({ cardId: t.card.id })) },
      targetPlayerId: moveTargetPlayerId(group[0].ownerPlayerId, dest.targetZone, dest.targetPlayerId),
      targetZone: dest.targetZone,
      x: dest.x,
      y: dest.y,
      isReversed: false,
    }, judgeTarget(group[0].ownerPlayerId));
  });
}
