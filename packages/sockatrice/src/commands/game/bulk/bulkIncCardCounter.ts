import { create } from '@bufbuild/protobuf';

import { Command_IncCardCounter_ext, Command_IncCardCounterSchema } from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';
import { WebClient } from '../../../WebClient';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Apply the same counter delta to every selected card, batched into one
// container. Mirrors Cockatrice's incCardCounter across the selection. Each
// command judge-wraps as its card's owner.
export function bulkIncCardCounter(
  gameId: number,
  targets: readonly CardLocation[],
  counterId: number,
  counterDelta: number,
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (targets.length === 0) {
    return;
  }
  const entries: GameCommandEntry[] = targets.map((t) => ({
    ext: Command_IncCardCounter_ext,
    value: create(Command_IncCardCounterSchema, {
      zone: t.zone,
      cardId: t.card.id,
      counterId,
      counterDelta,
    }),
    judgeTargetId: judgeTarget(t.ownerPlayerId),
  }));
  WebClient.instance.protobuf.sendGameCommands(gameId, entries);
}
