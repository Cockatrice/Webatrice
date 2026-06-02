import { useCallback } from 'react';

import { useGameAccess } from './useGameAccess';

/**
 * Encapsulates the judge-target rule. Returns a stable resolver: given a card's
 * owner, it yields the Command_Judge target (the owner) when the local user is a
 * judge acting on a card they don't own, or `undefined` when no wrapping is needed
 * (own card, or a non-judge — who can never reach a foreign card).
 *
 * Per-card commands (setCardAttr, flipCard, …) carry no player id, so a judge
 * acting on a foreign card wraps them in Command_Judge(target_id=owner) and the
 * server runs the inner command as the owner — mirroring Cockatrice's
 * PlayerActions::sendGameCommand, which wraps exactly when `judge && !local`.
 *
 * Consumers capture the resolver and pass it the owner; store-decoupled callers
 * (useGameDnd, bulkCardActions) receive the resolver as an argument instead.
 */
export function useJudgeTarget(
  gameId: number | undefined,
): (ownerPlayerId: number) => number | undefined {
  const { isJudge, localPlayerId } = useGameAccess(gameId);
  return useCallback(
    (ownerPlayerId: number) =>
      isJudge && ownerPlayerId !== localPlayerId ? ownerPlayerId : undefined,
    [isJudge, localPlayerId],
  );
}
