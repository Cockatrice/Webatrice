import { create } from '@bufbuild/protobuf';

import { Command_FlipCard_ext, Command_FlipCardSchema } from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';
import { WebClient } from '../../../WebClient';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Collective flip: if any selected card is face-up, flip them all face-down; else all up.
// Uses Command_FlipCard (not setCardAttr): only the flip event carries the revealed
// name/providerId when a card turns face-up.
export function bulkFlip(
  gameId: number,
  tableTargets: readonly CardLocation[],
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (tableTargets.length === 0) {
    return;
  }
  const faceDownAll = tableTargets.some((t) => !t.card.faceDown);
  const entries: GameCommandEntry[] = [];
  tableTargets.forEach((t) => {
    if (Boolean(t.card.faceDown) === faceDownAll) {
      return;
    }
    entries.push({
      ext: Command_FlipCard_ext,
      value: create(Command_FlipCardSchema, {
        zone: t.zone,
        cardId: t.card.id,
        faceDown: faceDownAll,
      }),
      judgeTargetId: judgeTarget(t.ownerPlayerId),
    });
  });
  if (entries.length === 0) {
    return;
  }
  WebClient.instance.protobuf.sendGameCommands(gameId, entries);
}
