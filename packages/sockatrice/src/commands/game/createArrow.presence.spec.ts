// Byte-level verification that Command_CreateArrow's proto2 optional target
// fields stay UNSET when the client wants the arrow to terminate on the
// targeted player rather than a card. Desktop's server reads
// `has_target_card_id()` / `has_target_zone()` and routes the arrow to the
// player when either field is absent — a serialized -1 sentinel would be
// interpreted as "arrow targets the card with id -1" instead.
//
// Mirrors `attachCard.presence.spec.ts`. Add a sibling spec like this for any
// new command with proto2 optional fields whose default value (-1, 0, "")
// is itself a meaningful signal — see comment at the top of attachCard's spec.

import { create, isFieldSet, toBinary, fromBinary } from '@bufbuild/protobuf';
import { Command_CreateArrowSchema } from '../../generated';

describe('Command_CreateArrow proto2 presence (player-target invariant)', () => {
  it('omitting target_card_id and target_zone leaves them unset on the in-memory message', () => {
    const msg = create(Command_CreateArrowSchema, {
      startPlayerId: 1,
      startZone: 'table',
      startCardId: 10,
      targetPlayerId: 2,
    });

    expect(isFieldSet(msg, Command_CreateArrowSchema.field.startPlayerId)).toBe(true);
    expect(isFieldSet(msg, Command_CreateArrowSchema.field.targetPlayerId)).toBe(true);
    expect(isFieldSet(msg, Command_CreateArrowSchema.field.targetCardId)).toBe(false);
    expect(isFieldSet(msg, Command_CreateArrowSchema.field.targetZone)).toBe(false);
  });

  it('omitting target_card_id and target_zone omits them from the serialized bytes', () => {
    const msg = create(Command_CreateArrowSchema, {
      startPlayerId: 1,
      startZone: 'table',
      startCardId: 10,
      targetPlayerId: 2,
    });

    const bytes = toBinary(Command_CreateArrowSchema, msg);
    const parsed = fromBinary(Command_CreateArrowSchema, bytes);

    expect(isFieldSet(parsed, Command_CreateArrowSchema.field.targetCardId)).toBe(false);
    expect(isFieldSet(parsed, Command_CreateArrowSchema.field.targetZone)).toBe(false);
  });

  it('setting target_card_id to its default -1 still records presence (so "arrow targets card -1" still parses)', () => {
    const msg = create(Command_CreateArrowSchema, {
      startPlayerId: 1,
      startZone: 'table',
      startCardId: 10,
      targetCardId: -1,
    });

    expect(isFieldSet(msg, Command_CreateArrowSchema.field.targetCardId)).toBe(true);
  });

  it('omitting delete_in_phase keeps it unset (server reads "deleted immediately")', () => {
    const msg = create(Command_CreateArrowSchema, {
      startPlayerId: 1,
      startZone: 'table',
      startCardId: 10,
      targetPlayerId: 2,
      targetZone: 'table',
      targetCardId: 99,
    });

    const bytes = toBinary(Command_CreateArrowSchema, msg);
    const parsed = fromBinary(Command_CreateArrowSchema, bytes);

    expect(isFieldSet(parsed, Command_CreateArrowSchema.field.deleteInPhase)).toBe(false);
  });

  it('setting delete_in_phase to 0 records presence (phase 0 is a valid signal)', () => {
    const msg = create(Command_CreateArrowSchema, {
      startPlayerId: 1,
      startZone: 'table',
      startCardId: 10,
      targetPlayerId: 2,
      targetZone: 'table',
      targetCardId: 99,
      deleteInPhase: 0,
    });

    const bytes = toBinary(Command_CreateArrowSchema, msg);
    const parsed = fromBinary(Command_CreateArrowSchema, bytes);

    expect(isFieldSet(parsed, Command_CreateArrowSchema.field.deleteInPhase)).toBe(true);
    expect(parsed.deleteInPhase).toBe(0);
  });
});
