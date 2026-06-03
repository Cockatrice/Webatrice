import { CardAttribute } from '../../../generated';
import { bulkSetCardAttr } from './bulkSetCardAttr';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Collective doesn't-untap: if any selected card is unset, set them all; else clear all.
export function bulkDoesntUntap(
  gameId: number,
  tableTargets: readonly CardLocation[],
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  if (tableTargets.length === 0) {
    return;
  }
  const setAll = tableTargets.some((t) => !t.card.doesntUntap);
  bulkSetCardAttr(
    gameId,
    tableTargets,
    CardAttribute.AttrDoesntUntap,
    (t) => (Boolean(t.card.doesntUntap) === setAll ? undefined : setAll ? '1' : '0'),
    judgeTarget,
  );
}
