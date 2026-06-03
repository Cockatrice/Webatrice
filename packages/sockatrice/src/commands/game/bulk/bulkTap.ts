import { CardAttribute } from '../../../generated';
import { bulkSetCardAttr } from './bulkSetCardAttr';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Cockatrice collective tap rule (table_zone.cpp::toggleTapped): if any selected
// card is untapped, tap them all; otherwise untap them all. One batched command.
export function bulkTap(
  gameId: number,
  tableTargets: readonly CardLocation[],
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (tableTargets.length === 0) {
    return;
  }
  const tapAll = tableTargets.some((t) => !t.card.tapped);
  bulkSetCardAttr(
    gameId,
    tableTargets,
    CardAttribute.AttrTapped,
    (t) => (t.card.tapped === tapAll ? undefined : tapAll ? '1' : '0'),
    judgeTarget,
  );
}
