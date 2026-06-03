import { create } from '@bufbuild/protobuf';

import { Command_MoveCard_ext, Command_MoveCardSchema } from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';
import { WebClient } from '../../../WebClient';
import { moveTargetPlayerId } from './moveTargetPlayerId';
import { NO_JUDGE, type BulkMoveDestination, type CardLocation, type JudgeTarget } from './types';

export function bulkMove(
  gameId: number,
  targets: readonly CardLocation[],
  dest: BulkMoveDestination,
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  // One moveCard per (owner, zone) origin; the proto's ListOfCardsToMove carries the group.
  const groups = new Map<string, CardLocation[]>();
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
  // All groups ride in one batched container. A judge moving a foreign group wraps
  // it as that group's owner.
  const entries: GameCommandEntry[] = [];
  groups.forEach((group) => {
    entries.push({
      ext: Command_MoveCard_ext,
      value: create(Command_MoveCardSchema, {
        startPlayerId: group[0].ownerPlayerId,
        startZone: group[0].zone,
        cardsToMove: { card: group.map((t) => ({ cardId: t.card.id })) },
        targetPlayerId: moveTargetPlayerId(group[0].ownerPlayerId, dest.targetZone, dest.targetPlayerId),
        targetZone: dest.targetZone,
        x: dest.x,
        y: dest.y,
        isReversed: false,
      }),
      judgeTargetId: judgeTarget(group[0].ownerPlayerId),
    });
  });
  if (entries.length === 0) {
    return;
  }
  WebClient.instance.protobuf.sendGameCommands(gameId, entries);
}
