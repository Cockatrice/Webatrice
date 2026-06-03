import { create } from '@bufbuild/protobuf';

import { CardAttribute, Command_SetCardAttr_ext, Command_SetCardAttrSchema } from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';
import { WebClient } from '../../../WebClient';
import type { CardLocation, JudgeTarget } from './types';

// Builds one SetCardAttr command per target whose state actually changes (valueFn
// returns undefined to skip a card already in the target state) and sends them as a
// single batch. Each command judge-wraps as its card's owner. Shared by the
// attribute-style bulk commands (tap, doesn't-untap). See sendGameCommands.
export function bulkSetCardAttr(
  gameId: number,
  targets: readonly CardLocation[],
  attribute: CardAttribute,
  valueFn: (target: CardLocation) => string | undefined,
  judgeTarget: JudgeTarget,
): void {
  const entries: GameCommandEntry[] = [];
  targets.forEach((t) => {
    const attrValue = valueFn(t);
    if (attrValue === undefined) {
      return;
    }
    entries.push({
      ext: Command_SetCardAttr_ext,
      value: create(Command_SetCardAttrSchema, {
        zone: t.zone,
        cardId: t.card.id,
        attribute,
        attrValue,
      }),
      judgeTargetId: judgeTarget(t.ownerPlayerId),
    });
  });
  if (entries.length === 0) {
    return;
  }
  WebClient.instance.protobuf.sendGameCommands(gameId, entries);
}
