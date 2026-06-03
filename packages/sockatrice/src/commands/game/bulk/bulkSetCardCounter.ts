import { create } from '@bufbuild/protobuf';

import { Command_SetCardCounter_ext, Command_SetCardCounterSchema } from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';
import { WebClient } from '../../../WebClient';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Set the same counter value on every selected card, batched into one container.
// Mirrors Cockatrice's setCardCounter across the selection. Each command
// judge-wraps as its card's owner.
export function bulkSetCardCounter(
  gameId: number,
  targets: readonly CardLocation[],
  counterId: number,
  counterValue: number,
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (targets.length === 0) {
    return;
  }
  const entries: GameCommandEntry[] = targets.map((t) => ({
    ext: Command_SetCardCounter_ext,
    value: create(Command_SetCardCounterSchema, {
      zone: t.zone,
      cardId: t.card.id,
      counterId,
      counterValue,
    }),
    judgeTargetId: judgeTarget(t.ownerPlayerId),
  }));
  WebClient.instance.protobuf.sendGameCommands(gameId, entries);
}
