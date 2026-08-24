import { isMessage } from '@bufbuild/protobuf';
import type { Middleware } from '@reduxjs/toolkit';

// Dev-only guard for the store's one unguarded hazard: mutating a stored
// protobuf-es message in place (`card.x = y`). Immer can't draft messages, so
// such a write is untracked and fails as silent staleness (see
// .github/instructions/datatrice-store.instructions.md#reducer-author-hazards).
// Freezing every message as it enters the store turns that write into a
// TypeError thrown at the offending line.
//
// Freezing happens at state entry — after the reducers run — never at message
// creation: bare `clone()` outputs are legitimately patched while a payload is
// being built, and only lose mutability once a dispatch lands them in state.
//
// The walk is O(changed path), not O(state): Immer's path-copying preserves the
// identity of untouched subtrees, so the `seen` WeakSet skips everything that
// survived from the previous dispatch. (The O(state)-per-dispatch cost that got
// RTK's invariant middlewares disabled cannot recur here.)

const seen = new WeakSet<object>();

function freezeNewMessages(value: unknown, insideMessage: boolean): void {
  if (value === null || typeof value !== 'object') {
    return;
  }
  const obj = value as Record<string, unknown>;
  if (seen.has(obj)) {
    return;
  }
  seen.add(obj);
  if (obj instanceof Uint8Array) {
    // Object.freeze throws on non-empty typed arrays (bytes fields).
    return;
  }
  // Freeze the message and everything inside it (nested messages, repeated
  // and map fields — an in-place `msg.list.push(...)` is the same hazard).
  // Plain containers outside a message subtree are only traversed: those are
  // Immer-drafted and already auto-frozen by Immer itself.
  const nowInside = insideMessage || isMessage(obj);
  if (nowInside && !Object.isFrozen(obj)) {
    Object.freeze(obj);
  }
  for (const nested of Object.values(obj)) {
    freezeNewMessages(nested, nowInside);
  }
}

const dontFreezeMessages: Middleware = () => (next) => (action) => next(action);

const freezeMessages: Middleware = ({ getState }) => (next) => (action) => {
  const result = next(action);
  freezeNewMessages(getState(), false);
  return result;
};

// Bare `process.env.NODE_ENV` on purpose (the RTK convention): app bundlers
// statically replace the whole expression, and Node reads the real global. A
// `typeof process` guard would defeat the static replacement and leave the
// middleware active in production browser builds. Declared locally so the
// lib's types don't depend on @types/node.
declare const process: { env: { NODE_ENV?: string } };

export const freezeMessagesMiddleware: Middleware = process.env.NODE_ENV === 'production'
  ? dontFreezeMessages
  : freezeMessages;
