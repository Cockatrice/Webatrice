import { create } from '@bufbuild/protobuf';

import { Command_SetCardCounter_ext, Command_SetCardCounterSchema } from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';
import { WebClient } from '../../../WebClient';
import { NO_JUDGE, type JudgeTarget } from './types';

// One heterogeneous entry: the (zone, cardId) target plus its own
// counter id AND counter value. Different from bulkSetCardCounter,
// which sets the same value on every target. Matches Cockatrice's
// actIncrementAllCardCounters flow (player_actions.cpp:1588-1621),
// which builds a Command_SetCardCounter per (card, counter) with
// each card's own currentValue+1.
export interface CardCounterEntry {
  ownerPlayerId: number;
  zone: string;
  cardId: number;
  counterId: number;
  counterValue: number;
}

// Set arbitrary (cardId, counterId, counterValue) triples in a single
// CommandContainer — one atomic wire. Mirrors Cockatrice's
// prepareGameCommand(commandList) call in actIncrementAllCardCounters
// which batches per-card SetCardCounter deltas into a single command
// container. Each entry judge-wraps as its card's owner.
export function bulkSetCardCounterEntries(
  gameId: number,
  entries: readonly CardCounterEntry[],
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (entries.length === 0) {
    return;
  }
  const gameEntries: GameCommandEntry[] = entries.map((e) => ({
    ext: Command_SetCardCounter_ext,
    value: create(Command_SetCardCounterSchema, {
      zone: e.zone,
      cardId: e.cardId,
      counterId: e.counterId,
      counterValue: e.counterValue,
    }),
    judgeTargetId: judgeTarget(e.ownerPlayerId),
  }));
  WebClient.instance.protobuf.sendGameCommands(gameId, gameEntries);
}
