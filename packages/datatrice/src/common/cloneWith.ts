import { clone } from '@bufbuild/protobuf';
import type { DescMessage, MessageShape } from '@bufbuild/protobuf';

// Clone a protobuf-es message and apply a partial field patch, returning a NEW message.
//
// Immer can't draft protobuf-es messages — proto2 builds them with `Object.create(prototype)`
// to track field presence, so their non-`Object.prototype` prototype makes Immer's
// `isDraftable` skip them. A reducer that mutates a stored message in place (`card.x = y`)
// therefore goes untracked: the reference never changes and selectors keep serving the
// cached value. The fix is to REASSIGN a fresh message instead of mutating in place.
//
// `clone` is used (not a spread) because spreading a proto2 message drops unset optional
// fields — they live on the prototype, not as own properties. `clone` copies everything.
export function cloneWith<S extends DescMessage>(
  schema: S,
  message: MessageShape<S>,
  patch: Partial<MessageShape<S>>,
): MessageShape<S> {
  const next = clone(schema, message);
  Object.assign(next, patch);
  return next;
}
