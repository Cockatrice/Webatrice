import { create } from '@bufbuild/protobuf';

import { Command_RevealCards_ext, Command_RevealCardsSchema } from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';
import { WebClient } from '../../../WebClient';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Peek reveals each selected card to a single player only (parity with actPeek).
// One RevealCards per card preserves each card's zone.
export function bulkPeek(
  gameId: number,
  targets: readonly CardLocation[],
  revealToPlayerId: number,
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (targets.length === 0) {
    return;
  }
  const entries: GameCommandEntry[] = targets.map((t) => ({
    ext: Command_RevealCards_ext,
    value: create(Command_RevealCardsSchema, {
      zoneName: t.zone,
      cardId: [t.card.id],
      playerId: revealToPlayerId,
      topCards: -1,
    }),
    judgeTargetId: judgeTarget(t.ownerPlayerId),
  }));
  WebClient.instance.protobuf.sendGameCommands(gameId, entries);
}
