
type RollbackFn = () => void;

const pendingOps = new Map<string, RollbackFn>();

/** Register an optimistic op and its rollback closure. Overwrites any
 *  existing entry for the same key — the newer intent replaces the
 *  older one (matches the behavior of clicking twice rapidly). */
export function beginOptimistic(key: string, rollback: RollbackFn): void {
  pendingOps.set(key, rollback);
}

/** Non-mutating check — returns true if a pending op exists for the
 *  key. Used by the listener middleware to decide whether to skip the
 *  reducer dispatch on the server-side echo. */
export function isOptimisticPending(key: string): boolean {
  return pendingOps.has(key);
}

/** Remove the entry without invoking the rollback. Called by the
 *  listener middleware when the server-side echo confirms the change —
 *  the optimistic state is now the authoritative state, so the
 *  bookkeeping entry is no longer needed. */
export function consumeOptimistic(key: string): boolean {
  return pendingOps.delete(key);
}

/** Roll back and remove. Called from the wire layer's `onError`
 *  callback when the server rejects the command. */
export function rollbackOptimistic(key: string): void {
  const rollback = pendingOps.get(key);
  if (rollback) {
    rollback();
    pendingOps.delete(key);
  }
}

/** Key builder for card-move ops. Keyed by (source-player, card id)
 *  because the wire path always addresses the card by its original
 *  location, and the server's Event_MoveCard broadcast carries the
 *  same identifiers — matching both sides. */
export function moveOpKey(sourcePlayerId: number, cardId: number): string {
  return `move:${sourcePlayerId}:${cardId}`;
}

/** Key builder for card-attribute ops (tap, doesntUntap, etc.). The
 *  attribute name is part of the key so simultaneous ops on different
 *  attributes of the same card don't overwrite each other. */
export function attrOpKey(playerId: number, cardId: number, attribute: string | number): string {
  return `attr:${playerId}:${cardId}:${attribute}`;
}
