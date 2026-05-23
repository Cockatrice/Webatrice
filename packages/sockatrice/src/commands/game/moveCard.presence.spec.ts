// Byte-level verification that Command_MoveCard's proto2 optional target
// fields stay UNSET when the client wants an intra-zone reorder (start and
// target zones identical). Desktop's server reads `has_target_zone()` /
// `has_target_player_id()` and falls back to the source values when absent
// — see [[project_protobuf-default-stripped-intra-zone]] for the reducer-side
// twin of this contract.
//
// Mirrors `attachCard.presence.spec.ts`. See the pattern docs in that spec.

import { create, isFieldSet, toBinary, fromBinary } from '@bufbuild/protobuf';
import { Command_MoveCardSchema } from '../../generated';

describe('Command_MoveCard proto2 presence (intra-zone move invariant)', () => {
  it('omitting target_zone and target_player_id keeps them unset across the round trip', () => {
    const msg = create(Command_MoveCardSchema, {
      startPlayerId: 1,
      startZone: 'hand',
    });

    const bytes = toBinary(Command_MoveCardSchema, msg);
    const parsed = fromBinary(Command_MoveCardSchema, bytes);

    expect(isFieldSet(parsed, Command_MoveCardSchema.field.targetZone)).toBe(false);
    expect(isFieldSet(parsed, Command_MoveCardSchema.field.targetPlayerId)).toBe(false);
  });

  it('setting target_player_id to 0 records presence (player 0 is a valid signal)', () => {
    const msg = create(Command_MoveCardSchema, {
      startPlayerId: 1,
      startZone: 'hand',
      targetPlayerId: 0,
      targetZone: 'table',
    });

    const bytes = toBinary(Command_MoveCardSchema, msg);
    const parsed = fromBinary(Command_MoveCardSchema, bytes);

    expect(isFieldSet(parsed, Command_MoveCardSchema.field.targetPlayerId)).toBe(true);
    expect(parsed.targetPlayerId).toBe(0);
  });

  it('explicit target_zone identical to start_zone still records presence (intra-zone vs cross-zone is a client decision)', () => {
    const msg = create(Command_MoveCardSchema, {
      startPlayerId: 1,
      startZone: 'hand',
      targetPlayerId: 1,
      targetZone: 'hand',
    });

    const bytes = toBinary(Command_MoveCardSchema, msg);
    const parsed = fromBinary(Command_MoveCardSchema, bytes);

    expect(isFieldSet(parsed, Command_MoveCardSchema.field.targetZone)).toBe(true);
    expect(parsed.targetZone).toBe('hand');
  });

  it('omitting x and y keeps them unset (server appends to default slot)', () => {
    const msg = create(Command_MoveCardSchema, {
      startPlayerId: 1,
      startZone: 'hand',
      targetPlayerId: 1,
      targetZone: 'table',
    });

    const bytes = toBinary(Command_MoveCardSchema, msg);
    const parsed = fromBinary(Command_MoveCardSchema, bytes);

    expect(isFieldSet(parsed, Command_MoveCardSchema.field.x)).toBe(false);
    expect(isFieldSet(parsed, Command_MoveCardSchema.field.y)).toBe(false);
  });

  it('setting x to its default -1 still records presence (so "move to slot -1" parses)', () => {
    const msg = create(Command_MoveCardSchema, {
      startPlayerId: 1,
      startZone: 'hand',
      targetPlayerId: 1,
      targetZone: 'table',
      x: -1,
    });

    expect(isFieldSet(msg, Command_MoveCardSchema.field.x)).toBe(true);
  });
});
