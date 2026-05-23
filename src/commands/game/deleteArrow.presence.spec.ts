// Byte-level verification that Command_DeleteArrow's only optional field —
// `arrow_id` — survives the wire-format round trip with the right presence
// semantics. Server-side, `arrow_id` defaults to -1; the client must always
// send an explicit id, and a missing field is an invariant violation.
//
// Mirrors `attachCard.presence.spec.ts`. See the pattern docs in that spec.

import { create, isFieldSet, toBinary, fromBinary } from '@bufbuild/protobuf';
import { Command_DeleteArrowSchema } from '../../generated';

describe('Command_DeleteArrow proto2 presence', () => {
  it('explicit arrow_id records presence and survives round-trip', () => {
    const msg = create(Command_DeleteArrowSchema, { arrowId: 42 });

    const bytes = toBinary(Command_DeleteArrowSchema, msg);
    const parsed = fromBinary(Command_DeleteArrowSchema, bytes);

    expect(isFieldSet(parsed, Command_DeleteArrowSchema.field.arrowId)).toBe(true);
    expect(parsed.arrowId).toBe(42);
  });

  it('omitting arrow_id leaves it unset on the in-memory message and on the wire', () => {
    const msg = create(Command_DeleteArrowSchema, {});
    const bytes = toBinary(Command_DeleteArrowSchema, msg);
    const parsed = fromBinary(Command_DeleteArrowSchema, bytes);

    expect(isFieldSet(parsed, Command_DeleteArrowSchema.field.arrowId)).toBe(false);
  });

  it('setting arrow_id to its default -1 still records presence (so "delete arrow -1" parses)', () => {
    const msg = create(Command_DeleteArrowSchema, { arrowId: -1 });
    const bytes = toBinary(Command_DeleteArrowSchema, msg);
    const parsed = fromBinary(Command_DeleteArrowSchema, bytes);

    expect(isFieldSet(parsed, Command_DeleteArrowSchema.field.arrowId)).toBe(true);
    expect(parsed.arrowId).toBe(-1);
  });
});
