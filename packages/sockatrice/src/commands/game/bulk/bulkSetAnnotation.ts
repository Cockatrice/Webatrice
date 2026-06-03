import { CardAttribute } from '../../../generated';
import { bulkSetCardAttr } from './bulkSetCardAttr';
import { NO_JUDGE, type CardLocation, type JudgeTarget } from './types';

// Set the same annotation on every selected card in one batched container.
// Mirrors Cockatrice's setCardAttr(AttrAnnotation) applied across the whole
// selection. Each command judge-wraps as its card's owner.
export function bulkSetAnnotation(
  gameId: number,
  targets: readonly CardLocation[],
  annotation: string,
  judgeTarget: JudgeTarget = NO_JUDGE,
): void {
  bulkSetCardAttr(gameId, targets, CardAttribute.AttrAnnotation, () => annotation, judgeTarget);
}
