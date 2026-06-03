import { CardAttribute } from '../../../generated';
import { bulkSetCardAttr } from './bulkSetCardAttr';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Set the same power/toughness string on every selected card in one batched
// container. Mirrors Cockatrice's setCardAttr(AttrPT) applied across the whole
// selection ("set" semantics — the value goes to every target). Each command
// judge-wraps as its card's owner.
export function bulkSetPT(
  gameId: number,
  targets: readonly CardLocation[],
  pt: string,
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  bulkSetCardAttr(gameId, targets, CardAttribute.AttrPT, () => pt, judgeTarget);
}
